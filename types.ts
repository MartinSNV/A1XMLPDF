
export interface Address {
  ulica: string;
  supisneCislo: string;
  orientacneCislo: string;
  obec: string;
  psc: string;
  stat: string;
}

export interface MiestoVyslania {
  obchodneMeno: string;
  ico: string;
  adresa: Address;
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
  pohlavie: 'Muž' | 'Žena' | '';
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
  skNace: string;
  dostupneCinnosti?: string[];

  zadatAdresuMiestaPodnikania: boolean;
  adresaMiestaPodnikania: Address;

  // Prerušenie živnosti
  prerusenieZivnosti: boolean;
  prerusenieOd: string;
  prerusenieDo: string;

  // Skutočná činnosť na Slovensku
  skutocnaCinnostOd: string;
  skutocnaCinnostDo: string;
  skutocnaCinnostHodinMesacne: string;

  // Predošlá činnosť v štáte vyslania
  cinnostVStatePredVyslanim: boolean;
  cinnostVStatePredOd: string;
  cinnostVStatePredDo: string;

  // Vyslanie
  statVyslania: string;
  dalsieMiestaVyslania: MiestoVyslania[];
  datumZaciatkuVyslania: string;
  datumKoncaVyslania: string;
  obchodneMenoPrijimajucejOsoby: string;
  icoPrijimajucejOsoby: string;
  adresaVyslania: Address;
  popisCinnosti: string;
  
  // Otázky Q5/Q6
  obvykleMiestoVykonuCinnosti: boolean;  // EndingOfSending - predpokladá výkon po ukončení
  zachovaPriestory: boolean;             // RetainingPremises - zachová priestory

  nahradenieOsoby: boolean;
  vykonavanieCinnostiPreInuOsobu: boolean;
  najomPracovnejSily: boolean;

  // Dokument A1 vydaný
  // Vydaný v inej krajine
  vydanyVInejKrajine: boolean;
  vydanyVInejKrajineOd: string;
  vydanyVInejKrajineDo: string;
  vydanyVInejKrajineDatum: string;
  vydanyVInejKrajineInstitucia: string;
  
  // Ostatne
  pobocka: string;
  poznamka: string;
  isForeigner: boolean;
}
