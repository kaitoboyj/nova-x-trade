// Every language the Google website translator can render the site into.
// Kept as plain data so the picker can search across code, English and native
// names without pulling in an i18n runtime or maintaining dictionaries.

export interface Language {
  code: string;
  /** English name, e.g. "Spanish". */
  name: string;
  /** Endonym shown to the user, e.g. "Español". */
  native: string;
  /** Right-to-left script. */
  rtl?: boolean;
}

const RTL = new Set(["ar", "he", "dv", "fa", "ps", "sd", "ug", "ur", "yi", "ckb"]);

const RAW: Array<[string, string, string]> = [
  ["af", "Afrikaans", "Afrikaans"],
  ["sq", "Albanian", "Shqip"],
  ["am", "Amharic", "አማርኛ"],
  ["ar", "Arabic", "العربية"],
  ["hy", "Armenian", "Հայերեն"],
  ["as", "Assamese", "অসমীয়া"],
  ["ay", "Aymara", "Aymar aru"],
  ["az", "Azerbaijani", "Azərbaycan"],
  ["bm", "Bambara", "Bamanankan"],
  ["eu", "Basque", "Euskara"],
  ["be", "Belarusian", "Беларуская"],
  ["bn", "Bengali", "বাংলা"],
  ["bho", "Bhojpuri", "भोजपुरी"],
  ["bs", "Bosnian", "Bosanski"],
  ["bg", "Bulgarian", "Български"],
  ["ca", "Catalan", "Català"],
  ["ceb", "Cebuano", "Cebuano"],
  ["ny", "Chichewa", "Chichewa"],
  ["zh-CN", "Chinese (Simplified)", "简体中文"],
  ["zh-TW", "Chinese (Traditional)", "繁體中文"],
  ["co", "Corsican", "Corsu"],
  ["hr", "Croatian", "Hrvatski"],
  ["cs", "Czech", "Čeština"],
  ["da", "Danish", "Dansk"],
  ["dv", "Dhivehi", "ދިވެހި"],
  ["doi", "Dogri", "डोगरी"],
  ["nl", "Dutch", "Nederlands"],
  ["en", "English", "English"],
  ["eo", "Esperanto", "Esperanto"],
  ["et", "Estonian", "Eesti"],
  ["ee", "Ewe", "Eʋegbe"],
  ["fil", "Filipino", "Filipino"],
  ["fi", "Finnish", "Suomi"],
  ["fr", "French", "Français"],
  ["fy", "Frisian", "Frysk"],
  ["gl", "Galician", "Galego"],
  ["ka", "Georgian", "ქართული"],
  ["de", "German", "Deutsch"],
  ["el", "Greek", "Ελληνικά"],
  ["gn", "Guarani", "Avañe'ẽ"],
  ["gu", "Gujarati", "ગુજરાતી"],
  ["ht", "Haitian Creole", "Kreyòl ayisyen"],
  ["ha", "Hausa", "Hausa"],
  ["haw", "Hawaiian", "ʻŌlelo Hawaiʻi"],
  ["he", "Hebrew", "עברית"],
  ["hi", "Hindi", "हिन्दी"],
  ["hmn", "Hmong", "Hmoob"],
  ["hu", "Hungarian", "Magyar"],
  ["is", "Icelandic", "Íslenska"],
  ["ig", "Igbo", "Igbo"],
  ["ilo", "Ilocano", "Ilokano"],
  ["id", "Indonesian", "Bahasa Indonesia"],
  ["ga", "Irish", "Gaeilge"],
  ["it", "Italian", "Italiano"],
  ["ja", "Japanese", "日本語"],
  ["jv", "Javanese", "Basa Jawa"],
  ["kn", "Kannada", "ಕನ್ನಡ"],
  ["kk", "Kazakh", "Қазақ"],
  ["km", "Khmer", "ខ្មែរ"],
  ["rw", "Kinyarwanda", "Kinyarwanda"],
  ["gom", "Konkani", "कोंकणी"],
  ["ko", "Korean", "한국어"],
  ["kri", "Krio", "Krio"],
  ["ku", "Kurdish", "Kurdî"],
  ["ckb", "Kurdish (Sorani)", "کوردیی ناوەندی"],
  ["ky", "Kyrgyz", "Кыргызча"],
  ["lo", "Lao", "ລາວ"],
  ["la", "Latin", "Latina"],
  ["lv", "Latvian", "Latviešu"],
  ["ln", "Lingala", "Lingála"],
  ["lt", "Lithuanian", "Lietuvių"],
  ["lg", "Luganda", "Luganda"],
  ["lb", "Luxembourgish", "Lëtzebuergesch"],
  ["mk", "Macedonian", "Македонски"],
  ["mai", "Maithili", "मैथिली"],
  ["mg", "Malagasy", "Malagasy"],
  ["ms", "Malay", "Bahasa Melayu"],
  ["ml", "Malayalam", "മലയാളം"],
  ["mt", "Maltese", "Malti"],
  ["mi", "Maori", "Te Reo Māori"],
  ["mr", "Marathi", "मराठी"],
  ["mni-Mtei", "Meiteilon (Manipuri)", "মৈতৈলোন্"],
  ["lus", "Mizo", "Mizo ṭawng"],
  ["mn", "Mongolian", "Монгол"],
  ["my", "Myanmar (Burmese)", "မြန်မာ"],
  ["ne", "Nepali", "नेपाली"],
  ["no", "Norwegian", "Norsk"],
  ["or", "Odia (Oriya)", "ଓଡ଼ିଆ"],
  ["om", "Oromo", "Afaan Oromoo"],
  ["ps", "Pashto", "پښتو"],
  ["fa", "Persian", "فارسی"],
  ["pl", "Polish", "Polski"],
  ["pt", "Portuguese", "Português"],
  ["pa", "Punjabi", "ਪੰਜਾਬੀ"],
  ["qu", "Quechua", "Runasimi"],
  ["ro", "Romanian", "Română"],
  ["ru", "Russian", "Русский"],
  ["sm", "Samoan", "Gagana Samoa"],
  ["sa", "Sanskrit", "संस्कृतम्"],
  ["gd", "Scots Gaelic", "Gàidhlig"],
  ["nso", "Sepedi", "Sepedi"],
  ["sr", "Serbian", "Српски"],
  ["st", "Sesotho", "Sesotho"],
  ["sn", "Shona", "Shona"],
  ["sd", "Sindhi", "سنڌي"],
  ["si", "Sinhala", "සිංහල"],
  ["sk", "Slovak", "Slovenčina"],
  ["sl", "Slovenian", "Slovenščina"],
  ["so", "Somali", "Soomaali"],
  ["es", "Spanish", "Español"],
  ["su", "Sundanese", "Basa Sunda"],
  ["sw", "Swahili", "Kiswahili"],
  ["sv", "Swedish", "Svenska"],
  ["tg", "Tajik", "Тоҷикӣ"],
  ["ta", "Tamil", "தமிழ்"],
  ["tt", "Tatar", "Татар"],
  ["te", "Telugu", "తెలుగు"],
  ["th", "Thai", "ไทย"],
  ["ti", "Tigrinya", "ትግርኛ"],
  ["ts", "Tsonga", "Xitsonga"],
  ["tr", "Turkish", "Türkçe"],
  ["tk", "Turkmen", "Türkmen"],
  ["ak", "Twi (Akan)", "Akan"],
  ["uk", "Ukrainian", "Українська"],
  ["ur", "Urdu", "اردو"],
  ["ug", "Uyghur", "ئۇيغۇرچە"],
  ["uz", "Uzbek", "Oʻzbek"],
  ["vi", "Vietnamese", "Tiếng Việt"],
  ["cy", "Welsh", "Cymraeg"],
  ["xh", "Xhosa", "isiXhosa"],
  ["yi", "Yiddish", "ייִדיש"],
  ["yo", "Yoruba", "Yorùbá"],
  ["zu", "Zulu", "isiZulu"],
];

export const LANGUAGES: Language[] = RAW.map(([code, name, native]) => ({
  code,
  name,
  native,
  rtl: RTL.has(code),
}));

export const DEFAULT_LANGUAGE = "en";

export function languageByCode(code: string | null | undefined): Language | undefined {
  if (!code) return undefined;
  return LANGUAGES.find((l) => l.code === code);
}

export function isSupportedLanguage(code: string | null | undefined): boolean {
  return !!languageByCode(code);
}

/** Filters the list by code, English name or native name. */
export function searchLanguages(query: string): Language[] {
  const q = query.trim().toLowerCase();
  if (!q) return LANGUAGES;
  return LANGUAGES.filter(
    (l) =>
      l.code.toLowerCase().includes(q) ||
      l.name.toLowerCase().includes(q) ||
      l.native.toLowerCase().includes(q),
  );
}
