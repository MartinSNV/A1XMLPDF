
export interface Address {
  ulica: string;
  supisneCislo: string;
  orientacneCislo: string;
  obec: string;
  psc: string;
  stat: string;
}

export interface FormDataState {
  // Ziadatel
  titulPred: string;
  meno: string;
  priezvisko: string;
  rodnePriezvisko: string;
  titulZa: string;
  rodneCislo: string;
  datumNarodenia: string;
  miestoNarodenia: string;
  statNarodenia: string;
  statnaPrislusnost: string;
  pohlavie: 'Muž' | 'Žena' | ''; // UI values, mapped to 1/2 in XML
  adresaPobytu: Address;
  email: string;
  telefon: string;
  pobytovyPreukaz: boolean;

  zadatAdresuPrechodnehoPobytu: boolean;
  adresaPrechodnehoPobytu: Address;

  zadatKorespodencnuAdresu: boolean;
  korespodencnaAdresa: Address;
  
  // Podnikanie
  ico: string;
  obchodneMeno: string;
  datumZaciatkuCinnosti: string;
  identifikacneCisloVSocialnejPoistovni: string;
  cinnostSZCONaSlovensku: string;
  skNace: string; // Kód ekonomickej klasifikácie
  dostupneCinnosti?: string[]; // Zoznam činností z RPO

  zadatAdresuMiestaPodnikania: boolean;
  adresaMiestaPodnikania: Address;

  // Vyslanie
  statVyslania: string;
  adresaVyslania: Address;
  dalsieMiestaVyslania: Address[]; // Zoznam ďalších miest vyslania
  datumZaciatkuVyslania: string;
  datumKoncaVyslania: string;
  obchodneMenoPrijimajucejOsoby: string;
  icoPrijimajucejOsoby: string;
  popisCinnosti: string;
  
  obvykleMiestoVykonuCinnosti: boolean;
  nahradenieOsoby: boolean;
  vykonavanieCinnostiPreInuOsobu: boolean;
  najomPracovnejSily: boolean;
  
  // Ostatne
  pobocka: string; // Kód pobočky SP
  poznamka: string;
  isForeigner: boolean;
}
