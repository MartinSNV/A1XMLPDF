
export type FormType = 'vyslanie' | 'uplatnitelna';

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
  dic?: string;
  icdph?: string;
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

// ── Nový formulár: Žiadosť o určenie uplatniteľnej legislatívy ──────────────

export interface MiestoVykonuCinnosti {
  description: string;
  adresa: Address;
}

export interface KrajinaPodiel {
  krajina: string;
  podiel: number; // percento
}

export interface PrijemRok {
  rok: number;
  prijem: number;
}

export interface UplatnitelnaFormDataState {
  // Žiadateľ – prenesené z RPO / spoločné s A1
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

  // Obdobie žiadosti
  ziadostOd: string;
  ziadostDo: string;

  // Opakovaná/viacnásobná žiadosť
  opakovanaZiadost: boolean;

  // Dátum zdravotného poistenia
  datumZdravPoistenia: string;

  // Živnostenský list / podnikanie
  ico: string;
  obchodneMeno: string;
  adresaMiestaPodnikania: Address;

  // Krajina sídla (PlaceOfBusiness)
  krajinaSidla: string;

  // Obdobie výkonu činnosti
  cinnostOd: string;
  cinnostDo: string;

  // Pracovný čas (hodiny/mesiac)
  pracovnyCas: string;

  // Predmet SZČO
  predmetSZCO: string;

  // SK NACE
  skNace: string;

  // Typ výkonu (len SR alebo aj iná adresa/štát)
  typVykonu: 'iba_sr' | 'aj_ine';

  // Miesta výkonu činnosti (PlaceOfActivity.Locations)
  miestaVykonu: MiestoVykonuCinnosti[];

  // Krajiny výkonu (PlaceOfActivity.Countries)
  krajinyVykonu: string[];

  // Príjmy
  prijemAktualnyRok: number;
  prijemAktualnyRokCislo: number; // year
  predchadzajucePrijmy: PrijemRok[];

  // Percentá pracovného času PRED žiadosťou
  casovyPodielSKPred: number;
  casovePodielyIneKrajinyPred: KrajinaPodiel[];

  // Percentá pracovného času PO žiadosti
  casovyPodielSKPo: number;
  casovePodielyIneKrajinyPo: KrajinaPodiel[];

  // Percentá príjmov PO žiadosti
  prijmovyPodielSKPo: number;
  prijmovePodielyIneKrajinyPo: KrajinaPodiel[];

  // Dokument vydaný v inej krajine
  vydanyVInejKrajine: boolean;
  vydanyVInejKrajineOd: string;
  vydanyVInejKrajineDo: string;
  vydanyVInejKrajineDatum: string;
  vydanyVInejKrajineInstitucia: string;

  // Doplňujúce informácie
  doplnujuceInfo: string;

  // Príslušná pobočka SP
  pobocka: string;
  isForeigner: boolean;
}
