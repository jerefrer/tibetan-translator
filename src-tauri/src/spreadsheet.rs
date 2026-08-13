//! Reading a spreadsheet into a plain grid of strings.
//!
//! This module knows nothing about lexicons. It takes the bytes of a file and
//! hands back rows of strings — deciding whether row 0 is a header, or which
//! column means what, is the frontend's job (design doc §9). Keeping that
//! decision out of Rust is what makes this testable without a filesystem.
//!
//! It takes bytes rather than a path on purpose: the dialog plugin returns a
//! `content://` URI on Android and a `file://` URI on iOS, neither of which
//! `std::fs` can open. The frontend reads the file through `plugin-fs`, which
//! handles every path format, and sends the bytes here — the same arrangement
//! `install_custom_pack_from_bytes` already uses.

use calamine::{open_workbook_auto_from_rs, Data, Reader};
use serde::Serialize;
use std::io::Cursor;

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SpreadsheetGrid {
    pub sheet_name: String,
    pub headers: Vec<String>,
    pub rows: Vec<Vec<String>>,
}

/// Spreadsheet column labels: A..Z, then AA, AB, … Rust returns these rather
/// than the first row's values because deciding whether a header row exists is
/// the frontend's job.
pub fn column_letters(width: usize) -> Vec<String> {
    (0..width)
        .map(|mut index| {
            let mut label = String::new();
            loop {
                label.insert(0, (b'A' + (index % 26) as u8) as char);
                if index < 26 {
                    break;
                }
                index = index / 26 - 1;
            }
            label
        })
        .collect()
}

/// Excel for Windows writes semicolons in locales where the comma is the
/// decimal separator, so the delimiter has to be sniffed rather than assumed.
pub fn sniff_delimiter(sample: &str) -> u8 {
    let first_line = sample.lines().next().unwrap_or("");
    [b';', b'\t', b',']
        .into_iter()
        .filter(|delimiter| first_line.contains(*delimiter as char))
        .max_by_key(|delimiter| first_line.matches(*delimiter as char).count())
        .unwrap_or(b',')
}

/// UTF-8 when it is valid, CP1252 otherwise — the two encodings a spreadsheet
/// exported from Excel actually arrives in.
pub fn decode_bytes(bytes: &[u8]) -> String {
    match std::str::from_utf8(bytes) {
        Ok(text) => text.to_string(),
        Err(_) => encoding_rs::WINDOWS_1252.decode(bytes).0.into_owned(),
    }
}

/// Pad every row to the widest one so the grid is rectangular and the column
/// dropdowns have a stable length.
fn pad(rows: Vec<Vec<String>>) -> (usize, Vec<Vec<String>>) {
    let width = rows.iter().map(|row| row.len()).max().unwrap_or(0);
    let padded = rows
        .into_iter()
        .map(|mut row| {
            row.resize(width, String::new());
            row
        })
        .collect();
    (width, padded)
}

fn sheet_name_from(file_name: &str) -> String {
    std::path::Path::new(file_name)
        .file_stem()
        .map(|stem| stem.to_string_lossy().to_string())
        .unwrap_or_else(|| file_name.to_string())
}

pub fn read_delimited(data: &[u8], file_name: &str) -> Result<SpreadsheetGrid, String> {
    let text = decode_bytes(data);
    let mut reader = csv::ReaderBuilder::new()
        .delimiter(sniff_delimiter(&text))
        .flexible(true)
        .has_headers(false) // every row is data; the frontend decides
        .from_reader(text.as_bytes());

    let mut rows = Vec::new();
    for record in reader.records() {
        let record = record.map_err(|e| format!("parseFailed: {e}"))?;
        rows.push(record.iter().map(|cell| cell.trim().to_string()).collect());
    }

    let (width, rows) = pad(rows);
    Ok(SpreadsheetGrid {
        sheet_name: sheet_name_from(file_name),
        headers: column_letters(width),
        rows,
    })
}

fn cell_to_string(cell: &Data) -> String {
    match cell {
        Data::Empty => String::new(),
        Data::String(value) => value.trim().to_string(),
        other => other.to_string().trim().to_string(),
    }
}

pub fn read_workbook(data: Vec<u8>) -> Result<SpreadsheetGrid, String> {
    let mut workbook =
        open_workbook_auto_from_rs(Cursor::new(data)).map_err(|e| format!("readFailed: {e}"))?;
    let sheet_name = workbook
        .sheet_names()
        .first()
        .cloned()
        .ok_or_else(|| "emptyWorkbook".to_string())?;
    let range = workbook
        .worksheet_range(&sheet_name)
        .map_err(|e| format!("parseFailed: {e}"))?;

    let rows: Vec<Vec<String>> = range
        .rows()
        .map(|row| row.iter().map(cell_to_string).collect())
        .collect();

    let (width, rows) = pad(rows);
    Ok(SpreadsheetGrid {
        sheet_name,
        headers: column_letters(width),
        rows,
    })
}

/// Return the first sheet as a plain grid of strings. Makes no decision about
/// header rows or column meaning.
#[tauri::command]
pub fn read_spreadsheet(data: Vec<u8>, file_name: String) -> Result<SpreadsheetGrid, String> {
    let extension = std::path::Path::new(&file_name)
        .extension()
        .map(|ext| ext.to_string_lossy().to_lowercase())
        .unwrap_or_default();

    match extension.as_str() {
        "csv" | "tsv" | "txt" => read_delimited(&data, &file_name),
        _ => read_workbook(data),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn column_letters_walk_past_z() {
        assert_eq!(column_letters(3), vec!["A", "B", "C"]);
        assert_eq!(column_letters(27)[25], "Z");
        assert_eq!(column_letters(27)[26], "AA");
    }

    #[test]
    fn sniff_delimiter_prefers_the_commonest_on_the_first_line() {
        assert_eq!(sniff_delimiter("a;b;c\n1;2;3"), b';');
        assert_eq!(sniff_delimiter("a,b,c\n1,2,3"), b',');
        assert_eq!(sniff_delimiter("a\tb\tc"), b'\t');
    }

    #[test]
    fn sniff_delimiter_falls_back_to_comma_when_nothing_repeats() {
        assert_eq!(sniff_delimiter("single column"), b',');
    }

    #[test]
    fn decode_bytes_reads_utf8_unchanged() {
        assert_eq!(decode_bytes("སངས་རྒྱས་".as_bytes()), "སངས་རྒྱས་");
    }

    #[test]
    fn decode_bytes_falls_back_to_cp1252_for_invalid_utf8() {
        // 0xE9 is "é" in CP1252 and invalid on its own in UTF-8 — the byte
        // Excel for Windows writes when it saves a French CSV.
        assert_eq!(decode_bytes(&[b'c', b'l', b'\xE9']), "clé");
    }

    #[test]
    fn reads_a_semicolon_csv_into_a_rectangular_grid() {
        let grid = read_delimited("Terme;Traduction\nསངས་རྒྱས་;buddha\n".as_bytes(), "words.csv")
            .unwrap();
        assert_eq!(grid.sheet_name, "words");
        assert_eq!(grid.headers, vec!["A", "B"]);
        assert_eq!(grid.rows, vec![
            vec!["Terme".to_string(), "Traduction".to_string()],
            vec!["སངས་རྒྱས་".to_string(), "buddha".to_string()],
        ]);
    }

    #[test]
    fn pads_short_rows_so_every_row_has_the_same_width() {
        let grid = read_delimited("a,b,c\n1\n".as_bytes(), "ragged.csv").unwrap();
        assert_eq!(grid.headers.len(), 3);
        assert_eq!(grid.rows[1], vec!["1".to_string(), String::new(), String::new()]);
    }
}
