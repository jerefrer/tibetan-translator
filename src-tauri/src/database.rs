use once_cell::sync::OnceCell;
use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};
use std::fs;
#[cfg(mobile)]
use std::io::Write;
use std::path::PathBuf;
use std::sync::Mutex;
use tauri::{AppHandle, Manager};
#[cfg(mobile)]
use tauri_plugin_fs::FsExt;

static DB_CONNECTION: OnceCell<Mutex<Connection>> = OnceCell::new();

#[derive(Debug, Serialize, Deserialize)]
pub struct Dictionary {
    pub id: i64,
    pub name: String,
    pub position: i64,
    pub enabled: bool,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct Entry {
    pub id: i64,
    pub term: String,
    #[serde(rename = "termPhoneticsStrict")]
    pub term_phonetics_strict: String,
    #[serde(rename = "termPhoneticsLoose")]
    pub term_phonetics_loose: String,
    pub definition: String,
    #[serde(rename = "definitionPhoneticsWordsStrict")]
    pub definition_phonetics_words_strict: String,
    #[serde(rename = "definitionPhoneticsWordsLoose")]
    pub definition_phonetics_words_loose: String,
    #[serde(rename = "dictionaryId")]
    pub dictionary_id: i64,
    pub dictionary: Option<String>,
    #[serde(rename = "dictionaryPosition")]
    pub dictionary_position: Option<i64>,
}

fn get_db_path(app: &AppHandle) -> Result<PathBuf, String> {
    // Get the app data directory - this is where we'll store/access the database
    let app_data_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("Failed to get app data dir: {}", e))?;

    // Ensure the directory exists
    fs::create_dir_all(&app_data_dir)
        .map_err(|e| format!("Failed to create app data dir: {}", e))?;

    // On mobile, use core.sqlite (smaller, modular); on desktop use full database
    #[cfg(mobile)]
    let db_filename = "core.sqlite";
    #[cfg(desktop)]
    let db_filename = "TibetanTranslator.sqlite";

    let db_path = app_data_dir.join(db_filename);

    // If database already exists in app data, use it
    if db_path.exists() {
        return Ok(db_path);
    }

    // Resolve the resource path
    let resource_path = app
        .path()
        .resolve(db_filename, tauri::path::BaseDirectory::Resource)
        .map_err(|e| format!("Failed to resolve resource path: {}", e))?;

    // On desktop, the resource path is a real file
    #[cfg(desktop)]
    {
        if resource_path.exists() {
            fs::copy(&resource_path, &db_path)
                .map_err(|e| format!("Failed to copy database: {}", e))?;
            return Ok(db_path);
        }
    }

    // On mobile, use the fs plugin to read from bundled assets
    #[cfg(mobile)]
    {
        // Use the fs plugin to read the bundled resource
        let contents = app
            .fs()
            .read(&resource_path)
            .map_err(|e| format!("Failed to read bundled database: {}", e))?;

        let mut file = fs::File::create(&db_path)
            .map_err(|e| format!("Failed to create database file: {}", e))?;
        file.write_all(&contents)
            .map_err(|e| format!("Failed to write database: {}", e))?;

        return Ok(db_path);
    }

    #[cfg(desktop)]
    Err(format!(
        "Database not found at {:?}",
        resource_path
    ))
}

fn get_connection() -> Result<&'static Mutex<Connection>, String> {
    DB_CONNECTION
        .get()
        .ok_or_else(|| "Database not initialized. Call init_database first.".to_string())
}

#[tauri::command]
pub fn init_database(app: AppHandle) -> Result<bool, String> {
    if DB_CONNECTION.get().is_some() {
        return Ok(true); // Already initialized
    }

    let db_path = get_db_path(&app)?;

    let conn = Connection::open(&db_path)
        .map_err(|e| format!("Failed to open database at {:?}: {}", db_path, e))?;

    DB_CONNECTION
        .set(Mutex::new(conn))
        .map_err(|_| "Failed to set database connection".to_string())?;

    Ok(true)
}

#[tauri::command]
pub fn get_all_terms() -> Result<Vec<String>, String> {
    let conn_mutex = get_connection()?;
    let conn = conn_mutex
        .lock()
        .map_err(|e| format!("Failed to lock connection: {}", e))?;

    let mut stmt = conn
        .prepare("SELECT DISTINCT term FROM entries ORDER BY term")
        .map_err(|e| format!("Failed to prepare statement: {}", e))?;

    let terms: Vec<String> = stmt
        .query_map([], |row| row.get(0))
        .map_err(|e| format!("Failed to query terms: {}", e))?
        .filter_map(|r| r.ok())
        .collect();

    Ok(terms)
}

#[tauri::command]
pub fn get_dictionaries() -> Result<Vec<Dictionary>, String> {
    let conn_mutex = get_connection()?;
    let conn = conn_mutex
        .lock()
        .map_err(|e| format!("Failed to lock connection: {}", e))?;

    let mut stmt = conn
        .prepare("SELECT id, name, position, enabled FROM dictionaries ORDER BY position")
        .map_err(|e| format!("Failed to prepare statement: {}", e))?;

    let dictionaries: Vec<Dictionary> = stmt
        .query_map([], |row| {
            Ok(Dictionary {
                id: row.get(0)?,
                name: row.get(1)?,
                position: row.get(2)?,
                enabled: row.get::<_, i64>(3)? != 0,
            })
        })
        .map_err(|e| format!("Failed to query dictionaries: {}", e))?
        .filter_map(|r| r.ok())
        .collect();

    Ok(dictionaries)
}

#[tauri::command]
pub fn get_entries_for_term(term: String) -> Result<Vec<Entry>, String> {
    let conn_mutex = get_connection()?;
    let conn = conn_mutex
        .lock()
        .map_err(|e| format!("Failed to lock connection: {}", e))?;

    let mut stmt = conn
        .prepare(
            "SELECT entries.id, entries.term, entries.termPhoneticsStrict, entries.termPhoneticsLoose,
                    entries.definition, entries.definitionPhoneticsWordsStrict,
                    entries.definitionPhoneticsWordsLoose, entries.dictionaryId,
                    dictionaries.name AS dictionary, dictionaries.position AS dictionaryPosition
             FROM entries
             INNER JOIN dictionaries ON dictionaries.id = entries.dictionaryId
             WHERE entries.term = ?
             ORDER BY dictionaries.position",
        )
        .map_err(|e| format!("Failed to prepare statement: {}", e))?;

    let entries: Vec<Entry> = stmt
        .query_map(params![term], |row| {
            Ok(Entry {
                id: row.get(0)?,
                term: row.get(1)?,
                term_phonetics_strict: row.get(2)?,
                term_phonetics_loose: row.get(3)?,
                definition: row.get(4)?,
                definition_phonetics_words_strict: row.get(5)?,
                definition_phonetics_words_loose: row.get(6)?,
                dictionary_id: row.get(7)?,
                dictionary: row.get(8)?,
                dictionary_position: row.get(9)?,
            })
        })
        .map_err(|e| format!("Failed to query entries: {}", e))?
        .filter_map(|r| r.ok())
        .collect();

    Ok(entries)
}

#[tauri::command]
pub fn search_entries(query: String, search_type: String) -> Result<Vec<Entry>, String> {
    let conn_mutex = get_connection()?;
    let conn = conn_mutex
        .lock()
        .map_err(|e| format!("Failed to lock connection: {}", e))?;

    // Escape special FTS5 characters and prepare the query
    let escaped_query = escape_fts5_query(&query);

    // Build the FTS5 MATCH clause based on search type
    let fts_query = match search_type.as_str() {
        "phonetics_strict" => format!(
            "(termPhoneticsStrict : \"{0}\" OR definitionPhoneticsWordsStrict : \"{0}\")",
            escaped_query
        ),
        "phonetics_loose" => format!(
            "(termPhoneticsLoose : \"{0}\" OR definitionPhoneticsWordsLoose : \"{0}\")",
            escaped_query
        ),
        _ => format!(
            "(term : \"{0}\" OR definition : \"{0}\")",
            escaped_query
        ),
    };

    let sql = format!(
        "SELECT entries.id, entries.term, entries.termPhoneticsStrict, entries.termPhoneticsLoose,
                entries.definition, entries.definitionPhoneticsWordsStrict,
                entries.definitionPhoneticsWordsLoose, entries.dictionaryId,
                dictionaries.name AS dictionary, dictionaries.position AS dictionaryPosition
         FROM entries
         INNER JOIN dictionaries ON dictionaries.id = entries.dictionaryId
         INNER JOIN entries_fts ON entries.id = entries_fts.rowid
         WHERE entries_fts MATCH '{}'
         LIMIT 5000",
        fts_query
    );

    let mut stmt = conn
        .prepare(&sql)
        .map_err(|e| format!("Failed to prepare search statement: {}", e))?;

    let entries: Vec<Entry> = stmt
        .query_map([], |row| {
            Ok(Entry {
                id: row.get(0)?,
                term: row.get(1)?,
                term_phonetics_strict: row.get(2)?,
                term_phonetics_loose: row.get(3)?,
                definition: row.get(4)?,
                definition_phonetics_words_strict: row.get(5)?,
                definition_phonetics_words_loose: row.get(6)?,
                dictionary_id: row.get(7)?,
                dictionary: row.get(8)?,
                dictionary_position: row.get(9)?,
            })
        })
        .map_err(|e| format!("Failed to execute search: {}", e))?
        .filter_map(|r| r.ok())
        .collect();

    Ok(entries)
}

#[tauri::command]
pub fn execute_query(sql: String, params_json: String) -> Result<serde_json::Value, String> {
    let conn_mutex = get_connection()?;
    let conn = conn_mutex
        .lock()
        .map_err(|e| format!("Failed to lock connection: {}", e))?;

    let params: Vec<String> = serde_json::from_str(&params_json)
        .unwrap_or_default();

    let mut stmt = conn
        .prepare(&sql)
        .map_err(|e| format!("Failed to prepare statement: {}", e))?;

    let column_count = stmt.column_count();
    let column_names: Vec<String> = stmt.column_names().iter().map(|s| s.to_string()).collect();

    let rusqlite_params: Vec<&dyn rusqlite::ToSql> = params
        .iter()
        .map(|s| s as &dyn rusqlite::ToSql)
        .collect();

    let rows: Vec<serde_json::Value> = stmt
        .query_map(rusqlite_params.as_slice(), |row| {
            let mut obj = serde_json::Map::new();
            for i in 0..column_count {
                let value: rusqlite::Result<rusqlite::types::Value> = row.get(i);
                if let Ok(v) = value {
                    let json_value = match v {
                        rusqlite::types::Value::Null => serde_json::Value::Null,
                        rusqlite::types::Value::Integer(i) => serde_json::json!(i),
                        rusqlite::types::Value::Real(f) => serde_json::json!(f),
                        rusqlite::types::Value::Text(s) => serde_json::Value::String(s),
                        rusqlite::types::Value::Blob(b) => serde_json::json!(b),
                    };
                    obj.insert(column_names[i].clone(), json_value);
                }
            }
            Ok(serde_json::Value::Object(obj))
        })
        .map_err(|e| format!("Failed to query: {}", e))?
        .filter_map(|r| r.ok())
        .collect();

    Ok(serde_json::Value::Array(rows))
}

fn escape_fts5_query(query: &str) -> String {
    // Escape quotes in FTS5 query
    query.replace('"', "\"\"")
}
