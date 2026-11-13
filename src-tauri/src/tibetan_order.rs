// Tibetan order for the glossary's SQL (`ORDER BY term COLLATE TIBETAN`).
// This mirrors src/services/tibetan-order.js step by step, so the two can be
// read side by side; tests/fixtures/tibetan-order.json holds them both to one
// order (see the tests below and tests/tibetan-order.test.js).
//
// Each syllable is read into its parts (root letter, prefix and superscript,
// prefix, superscript, subscripts, vowel, suffix, second suffix, fused vowel
// particle) and compared part by part. A syllable that cannot be read goes
// after the readable syllables of its first letter; a word that is not
// Tibetan goes after every Tibetan one. Equal keys fall back to the text.

use std::cmp::Ordering;

const LETTERS: u32 = 0x0f40;
const SUBJOINED: u32 = 0x0f90;
const LAST_LETTER: u32 = 0x0f6c;
const LAST_SUBJOINED: u32 = 0x0fbc;

const RA: u32 = 0x0f62;
const LA: u32 = 0x0f63;
const SA: u32 = 0x0f66;
const ACHUNG: u32 = 0x0f60;
const FIXED_RA: u32 = 0x0f6a;

// After every Tibetan letter's rank
const NOT_TIBETAN: i64 = 200;
// After the four prefix/superscript groups (0 to 3)
const UNREADABLE: i64 = 9;

/// Precomposed letters and vowels, written out (their canonical decomposition)
fn decomposed(code: u32) -> Option<&'static [u32]> {
    Some(match code {
        0x0f43 => &[0x0f42, 0x0fb7],
        0x0f4d => &[0x0f4c, 0x0fb7],
        0x0f52 => &[0x0f51, 0x0fb7],
        0x0f57 => &[0x0f56, 0x0fb7],
        0x0f5c => &[0x0f5b, 0x0fb7],
        0x0f69 => &[0x0f40, 0x0fb5],
        0x0f93 => &[0x0f92, 0x0fb7],
        0x0f9d => &[0x0f9c, 0x0fb7],
        0x0fa2 => &[0x0fa1, 0x0fb7],
        0x0fa7 => &[0x0fa6, 0x0fb7],
        0x0fac => &[0x0fab, 0x0fb7],
        0x0fb9 => &[0x0f90, 0x0fb5],
        0x0f73 => &[0x0f71, 0x0f72],
        0x0f75 => &[0x0f71, 0x0f74],
        0x0f81 => &[0x0f71, 0x0f80],
        _ => return None,
    })
}

/// Subscripts in their order: ya, ra, la, wa, and the ha of ལྷ
fn subscript_rank(code: u32) -> Option<i64> {
    match code {
        0x0fb1 | 0x0fbb => Some(1),
        0x0fb2 | 0x0fbc => Some(2),
        0x0fb3 => Some(3),
        0x0fad => Some(4),
        0x0fba => Some(4),
        0x0fb7 => Some(5),
        _ => None,
    }
}

fn vowel_rank(code: u32) -> Option<i64> {
    match code {
        0x0f72 => Some(1),
        0x0f74 => Some(2),
        0x0f7a => Some(3),
        0x0f7c => Some(4),
        _ => None,
    }
}

/// A vowel on a final འ is a particle: དགའི་, དགའུ་, དགའོ་
fn particle_rank(code: u32) -> Option<i64> {
    match code {
        0x0f72 => Some(1),
        0x0f74 => Some(2),
        0x0f7c => Some(3),
        _ => None,
    }
}

/// Which letters each prefix can stand before (ག ད བ མ འ)
fn prefixable(prefix: u32) -> &'static str {
    match prefix {
        0x0f42 => "ཅཉཏདནཞཟཡཤས",
        0x0f51 => "ཀགངཔབམ",
        0x0f56 => "ཀགཅཏདཙཞཟཤས",
        0x0f58 => "ཁགངཆཇཉཐདནཚཛ",
        0x0f60 => "ཁགཆཇཐདཕབཚཛ",
        _ => "",
    }
}

fn is_letter(code: u32) -> bool {
    (LETTERS..=LAST_LETTER).contains(&code)
}
fn is_subjoined(code: u32) -> bool {
    (SUBJOINED..=LAST_SUBJOINED).contains(&code)
}
fn is_sign(code: u32) -> bool {
    (0x0f71..=0x0f87).contains(&code)
}
fn rank_of(code: u32) -> i64 {
    (if code == FIXED_RA { RA } else { code }) as i64 - LETTERS as i64 + 1
}
fn base_of(code: u32) -> u32 {
    code - (SUBJOINED - LETTERS)
}

/// The separators the JS splits on: whitespace, tsheg, shad and the marks up to U+0F14
fn is_separator(c: char) -> bool {
    c.is_whitespace() || c == '\u{feff}' || ('\u{0f0b}'..='\u{0f14}').contains(&c)
}

fn decompose(text: &str) -> String {
    let mut out = String::with_capacity(text.len());
    for c in text.chars() {
        match decomposed(c as u32) {
            Some(parts) => out.extend(parts.iter().filter_map(|&p| char::from_u32(p))),
            None => out.push(c),
        }
    }
    out
}

/// A syllable's letters, each with what is written under and on it
#[derive(Clone)]
struct Stack {
    base: u32,
    subjoined: Vec<u32>,
    vowels: Vec<u32>,
}

fn stacks_of(syllable: &str) -> Option<Vec<Stack>> {
    let mut stacks: Vec<Stack> = Vec::new();
    for ch in syllable.chars() {
        let code = ch as u32;
        if is_letter(code) {
            stacks.push(Stack { base: code, subjoined: vec![], vowels: vec![] });
        } else if is_subjoined(code) && !stacks.is_empty() {
            stacks.last_mut()?.subjoined.push(code);
        } else if is_sign(code) && !stacks.is_empty() {
            stacks.last_mut()?.vowels.push(code);
        } else {
            return None;
        }
    }
    if stacks.is_empty() { None } else { Some(stacks) }
}

fn is_plain(stack: &Stack) -> bool {
    stack.subjoined.is_empty() && stack.vowels.is_empty()
}

fn can_prefix(prefix: u32, root: u32) -> bool {
    char::from_u32(root).is_some_and(|r| prefixable(prefix).contains(r))
}

/// The stack that holds the root: the one with a vowel or something under
/// it, or, in a syllable of plain letters, the one that reads as the root
fn root_index(stacks: &[Stack]) -> isize {
    if let Some(marked) = stacks.iter().position(|s| !is_plain(s)) {
        return marked as isize;
    }
    match stacks.len() {
        0..=2 => 0,
        3 => if can_prefix(stacks[0].base, stacks[1].base) { 1 } else { 0 },
        4 => 1,
        _ => -1,
    }
}

fn unreadable(syllable: &str) -> [i64; 10] {
    let first = syllable.chars().next().map_or(0, |c| c as u32);
    let root = if is_letter(first) {
        rank_of(first)
    } else if is_subjoined(first) {
        rank_of(base_of(first))
    } else {
        NOT_TIBETAN
    };
    [root, UNREADABLE, 0, 0, 0, 0, 0, 0, 0, 0]
}

/// One syllable's key: ten numbers, compared in order.
fn syllable_key(syllable: &str) -> [i64; 10] {
    let Some(mut stacks) = stacks_of(syllable) else { return unreadable(syllable) };

    let mut particle = 0;
    let last = stacks[stacks.len() - 1].clone();
    if stacks.len() > 1
        && last.base == ACHUNG
        && last.subjoined.is_empty()
        && last.vowels.len() == 1
        && particle_rank(last.vowels[0]).is_some()
    {
        particle = particle_rank(last.vowels[0]).unwrap_or(0);
        let n = stacks.len();
        stacks[n - 1] = Stack { vowels: vec![], ..last };
    }

    let index = root_index(&stacks);
    if !(0..=1).contains(&index) {
        return unreadable(syllable);
    }
    let index = index as usize;
    let prefix = if index == 1 { Some(&stacks[0]) } else { None };
    if prefix.is_some_and(|p| !is_plain(p)) {
        return unreadable(syllable);
    }
    let suffixes = &stacks[index + 1..];
    if suffixes.len() > 2 || !suffixes.iter().all(is_plain) {
        return unreadable(syllable);
    }

    let main = &stacks[index];
    let mut root = main.base;
    let mut superscript = 0;
    let mut subjoined: &[u32] = &main.subjoined;
    if [RA, LA, SA, FIXED_RA].contains(&root) {
        if let Some(&head) = subjoined.first() {
            if subscript_rank(head).is_none() {
                superscript = root;
                root = base_of(head);
                subjoined = &subjoined[1..];
            }
        }
    }
    if subjoined.len() > 2 || main.vowels.len() > 1 {
        return unreadable(syllable);
    }

    let subscript = |code: Option<&u32>| match code {
        None => 0,
        Some(&c) => subscript_rank(c).unwrap_or_else(|| 10 + rank_of(base_of(c))),
    };
    let vowel = main.vowels.first().map_or(0, |&v| vowel_rank(v).unwrap_or_else(|| 10 + (v as i64 - 0x0f70)));
    [
        rank_of(root),
        i64::from(prefix.is_some()) + if superscript != 0 { 2 } else { 0 },
        prefix.map_or(0, |p| rank_of(p.base)),
        if superscript != 0 { rank_of(superscript) } else { 0 },
        subscript(subjoined.first()),
        subscript(subjoined.get(1)),
        vowel,
        suffixes.first().map_or(0, |s| rank_of(s.base)),
        suffixes.get(1).map_or(0, |s| rank_of(s.base)),
        particle,
    ]
}

/// A word's key: its syllables' keys one after the other.
fn sort_key(text: &str) -> Vec<i64> {
    decompose(text)
        .split(is_separator)
        .filter(|s| !s.is_empty())
        .flat_map(syllable_key)
        .collect()
}

/// The text without its trailing separators, decomposed
fn normalized(text: &str) -> String {
    decompose(text).trim_end_matches(is_separator).to_string()
}

/// Compares two words in Tibetan order (the collation registered as TIBETAN).
pub fn compare(a: &str, b: &str) -> Ordering {
    // Vec ordering is lexicographic, a shorter prefix first: the JS compareKeys
    sort_key(a)
        .cmp(&sort_key(b))
        .then_with(|| normalized(a).as_str().cmp(normalized(b).as_str()))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn words() -> Vec<(String, String)> {
        let fixture: serde_json::Value =
            serde_json::from_str(include_str!("../../tests/fixtures/tibetan-order.json")).unwrap();
        fixture["words"]
            .as_array()
            .unwrap()
            .iter()
            .map(|pair| (pair[0].as_str().unwrap().to_string(), pair[1].as_str().unwrap().to_string()))
            .collect()
    }

    // The same fixed shuffle as the JS test, so a failure reads the same every run
    fn shuffled(list: &[String]) -> Vec<String> {
        let mut copy = list.to_vec();
        let mut seed: u64 = 7;
        for i in (1..copy.len()).rev() {
            seed = (seed * 9301 + 49297) % 233280;
            let j = ((seed as f64 / 233280.0) * (i as f64 + 1.0)).floor() as usize;
            copy.swap(i, j);
        }
        copy
    }

    fn wylie_of(list: &[String]) -> Vec<String> {
        let words = words();
        list.iter()
            .map(|t| words.iter().find(|(_, w)| w == t).unwrap().0.clone())
            .collect()
    }

    fn sorted(mut list: Vec<String>) -> Vec<String> {
        list.sort_by(|a, b| compare(a, b));
        list
    }

    fn strings(list: &[&str]) -> Vec<String> {
        list.iter().map(|s| s.to_string()).collect()
    }

    #[test]
    fn should_sort_words_the_way_tibetan_dictionaries_file_them() {
        let ordered: Vec<String> = words().into_iter().map(|(_, t)| t).collect();
        assert_eq!(wylie_of(&sorted(shuffled(&ordered))), wylie_of(&ordered));
    }

    #[test]
    fn should_sort_the_reversed_list_back_into_order_too() {
        let ordered: Vec<String> = words().into_iter().map(|(_, t)| t).collect();
        let mut reversed = ordered.clone();
        reversed.reverse();
        assert_eq!(wylie_of(&sorted(reversed)), wylie_of(&ordered));
    }

    #[test]
    fn should_file_a_word_under_its_root_letter_not_its_prefix() {
        assert_eq!(compare("བསྒྲུབ་", "ང་"), Ordering::Less);
        assert_eq!(compare("བསྒྲུབ་", "བ་"), Ordering::Less);
    }

    #[test]
    fn should_read_the_same_word_with_or_without_its_final_tsheg_or_shad() {
        assert_eq!(compare("སངས་རྒྱས", "སངས་རྒྱས་"), Ordering::Equal);
        assert_eq!(compare("སངས་རྒྱས།", "སངས་རྒྱས་"), Ordering::Equal);
    }

    #[test]
    fn should_put_words_that_are_not_tibetan_after_the_tibetan_ones() {
        assert_eq!(sorted(strings(&["dharma", "ཨོ་", "ཀ་"])), strings(&["ཀ་", "ཨོ་", "dharma"]));
    }

    #[test]
    fn should_file_a_sanskrit_stack_under_its_first_letter_precomposed_or_not() {
        assert_eq!(sorted(strings(&["ཁ་", "ཀྵ་", "ཀ་"])), strings(&["ཀ་", "ཀྵ་", "ཁ་"]));
        // U+0F69 against U+0F40 U+0FB5
        assert_eq!(compare("\u{f69}་", "\u{f40}\u{fb5}་"), Ordering::Equal);
        assert_eq!(sorted(strings(&["ཁ་", "\u{f69}་", "ཀ་"])), strings(&["ཀ་", "\u{f69}་", "ཁ་"]));
    }

    #[test]
    fn should_file_a_syllable_it_cannot_read_after_the_readable_ones_of_its_letter() {
        // Five letters in a row: no Tibetan syllable is written so
        assert_eq!(
            sorted(strings(&["ཁ་", "ཀཀཀཀཀ་", "ཀོ་"])),
            strings(&["ཀོ་", "ཀཀཀཀཀ་", "ཁ་"])
        );
    }
}
