
export const COUNTRY_MAP: Record<string, string> = {
  "Slovenská republika": "703",
  "Belgicko": "056",
  "Bulharsko": "100",
  "Cyprus": "196",
  "Česká republika": "203",
  "Dánsko": "208",
  "Estónsko": "233",
  "Fínsko": "246",
  "Francúzsko": "250",
  "Grécko": "300",
  "Holandsko": "528",
  "Chorvátsko": "191",
  "Írsko": "372",
  "Island": "352",
  "Lichtenštajnsko": "438",
  "Litva": "440",
  "Lotyšsko": "428",
  "Luxembursko": "442",
  "Maďarsko": "348",
  "Malta": "470",
  "Nemecko": "276",
  "Nórsko": "578",
  "Poľsko": "616",
  "Portugalsko": "620",
  "Rakúsko": "040",
  "Rumunsko": "642",
  "Slovinsko": "705",
  "Spojené kráľovstvo": "826",
  "Španielsko": "724",
  "Švajčiarsko": "756",
  "Švédsko": "752",
  "Taliansko": "380"
};

export const COUNTRIES = Object.keys(COUNTRY_MAP).sort((a, b) => {
    if (a === "Slovenská republika") return -1;
    if (b === "Slovenská republika") return 1;
    return a.localeCompare(b, 'sk');
});

export const BRANCH_OFFICES = [
  { code: "BA", name: "Bratislava" },
  { code: "TT", name: "Trnava" },
  { code: "TN", name: "Trenčín" },
  { code: "NR", name: "Nitra" },
  { code: "ZA", name: "Žilina" },
  { code: "BB", name: "Banská Bystrica" },
  { code: "PO", name: "Prešov" },
  { code: "KE", name: "Košice" },
  { code: "SN", name: "Spišská Nová Ves" },
  { code: "PB", name: "Považská Bystrica" },
  { code: "CA", name: "Čadca" },
  { code: "DK", name: "Dolný Kubín" },
  { code: "LM", name: "Liptovský Mikuláš" },
  { code: "MT", name: "Martin" },
  { code: "RV", name: "Rožňava" },
  { code: "PP", name: "Poprad" },
  { code: "SL", name: "Stará Ľubovňa" },
  { code: "HE", name: "Humenné" },
  { code: "MI", name: "Michalovce" },
  { code: "TV", name: "Trebišov" },
  { code: "BJ", name: "Bardejov" },
  { code: "SK", name: "Svidník" },
  { code: "VT", name: "Vranov nad Topľou" },
  { code: "SE", name: "Senica" },
  { code: "GA", name: "Galanta" },
  { code: "DS", name: "Dunajská Streda" },
  { code: "LV", name: "Levice" },
  { code: "NZ", name: "Nové Zámky" },
  { code: "KN", name: "Komárno" },
  { code: "TO", name: "Topoľčany" },
  { code: "ZV", name: "Zvolen" },
  { code: "ZH", name: "Žiar nad Hronom" },
  { code: "PD", name: "Prievidza" },
  { code: "RS", name: "Rimavská Sobota" },
  { code: "LC", name: "Lučenec" },
  { code: "VK", name: "Veľký Krtíš" }
].sort((a, b) => a.name.localeCompare(b.name, 'sk'));

export const NACE_CATEGORIES = [
  { code: "A", name: "A – Poľnohospodárstvo, lesníctvo a rybolov" },
  { code: "B", name: "B – Ťažba a dobývanie" },
  { code: "C", name: "C – Priemyselná výroba" },
  { code: "D", name: "D – Dodávka elektriny, plynu, pary a studeného vzduchu" },
  { code: "E", name: "E – Dodávka vody, čistenie a odvod odpadových vôd, odpady a služby odstraňovania odpadov" },
  { code: "F", name: "F – Stavebníctvo" },
  { code: "G", name: "G – Veľkoobchod a maloobchod, oprava motorových vozidiel a motocyklov" },
  { code: "H", name: "H – Doprava a skladovanie" },
  { code: "I", name: "I – Ubytovacie a stravovacie služby" },
  { code: "J", name: "J – Informácie a komunikácia" },
  { code: "K", name: "K – Finančné a poisťovacie činnosti" },
  { code: "L", name: "L – Činnosti v oblasti nehnuteľností" },
  { code: "M", name: "M – Odborné, vedecké a technické činnosti" },
  { code: "N", name: "N – Administratívne a podporné služby" },
  { code: "O", name: "O – Verejná správa a obrana, povinné sociálne zabezpečenia" },
  { code: "P", name: "P – Vzdelávanie" },
  { code: "Q", name: "Q – Zdravotníctvo a sociálna pomoc" },
  { code: "R", name: "R – Umenie, zábava a rekreácia" },
  { code: "S", name: "S – Ostatné činnosti" },
  { code: "T", name: "T – Činnosti domácností ako zamestnávateľov" },
  { code: "U", name: "U – Činnosti extrateritoriálnych organizácií a združení" }
];

export const TITLES_BEFORE = [
  "Bc.", "Mgr.", "Ing.", "MUDr.", "MVDr.", "PaedDr.", "PharmDr.", "PhDr.", "JUDr.", "RNDr.", "ThDr.", "doc.", "prof."
].sort();

export const TITLES_AFTER = [
  "PhD.", "CSc.", "DrSc.", "MBA", "MPH", "LL.M."
].sort();
