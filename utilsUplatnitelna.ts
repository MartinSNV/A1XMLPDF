// utilsUplatnitelna.ts
// XML generátor pre Žiadosť o určenie uplatniteľnej legislatívy (SZČO)
// Namespace: http://schemas.gov.sk/form/30807484.Ziadost_o_urcenie_uplatnitelnej_legislativy_osobe_SZCO.sk.pda/12.0

import type { UplatnitelnaFormDataState } from './types';
import { COUNTRY_MAP, NACE_CATEGORIES, BRANCH_OFFICES } from './constants';

const esc = (s: string): string => {
  if (typeof s !== 'string') return '';
  return s.replace(/[<>&'"]/g, c => {
    switch (c) {
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '&': return '&amp;';
      case "'": return '&apos;';
      case '"': return '&quot;';
      default: return c;
    }
  });
};

const codelist = (tag: string, codelistCode: string, itemCode: string, itemName: string) =>
  tag
    ? `<${tag}><Codelist><CodelistCode>${codelistCode}</CodelistCode><CodelistItem><ItemCode>${itemCode}</ItemCode><ItemName>${esc(itemName)}</ItemName></CodelistItem></Codelist></${tag}>`
    : `<Codelist><CodelistCode>${codelistCode}</CodelistCode><CodelistItem><ItemCode>${itemCode}</ItemCode><ItemName>${esc(itemName)}</ItemName></CodelistItem></Codelist>`;

const countryCode = (name: string) => COUNTRY_MAP[name] || '703';

export const generateUplatnitelnaXml = (formData: UplatnitelnaFormDataState): void => {
  const today = new Date().toISOString().split('T')[0];

  const activityCode = formData.typVykonu === 'iba_sr' ? '1' : '2';
  const activityName = formData.typVykonu === 'iba_sr'
    ? 'Samostatnú zárobkovú činnosť vykonávam iba v sídle'
    : 'Samostatnú zárobkovú činnosť vykonávam okrem sídla aj z inej adresy, resp. v inom štáte';

  const locations = formData.miestaVykonu.map(m => `
        <Locations>
          <Description>${esc(m.description)}</Description>
          <PhysicalAddress>
            <Municipality>${esc(m.adresa.obec)}</Municipality>
            <StreetName>${esc(m.adresa.ulica)}</StreetName>
            <BuildingNumber>${esc(m.adresa.orientacneCislo)}</BuildingNumber>
            <PropertyRegistrationNumber>${esc(m.adresa.supisneCislo)}</PropertyRegistrationNumber>
            <DeliveryAddress><PostalCode>${esc(m.adresa.psc.replace(/\s/g, ''))}</PostalCode></DeliveryAddress>
            ${codelist('Country', 'CL000086', countryCode(m.adresa.stat), m.adresa.stat)}
          </PhysicalAddress>
        </Locations>`).join('');

  const countriesXml = formData.krajinyVykonu.map(k => `
        <Countries>
          <Country>${codelist('', 'CL000086', countryCode(k), k)}</Country>
        </Countries>`).join('');

  const renderOtherCountry = (podiel: number, krajina: string) => `
      <OtherCountry>
        <Percentage>${podiel}</Percentage>
        <Name>${codelist('', 'CL000086', countryCode(krajina), krajina)}</Name>
      </OtherCountry>`;

  const workTimePred = `<InSlovakia>${formData.casovyPodielSKPred}</InSlovakia>`
    + formData.casovePodielyIneKrajinyPred.map(k => renderOtherCountry(k.podiel, k.krajina)).join('');

  const workTimePo = `<InSlovakia>${formData.casovyPodielSKPo}</InSlovakia>`
    + formData.casovePodielyIneKrajinyPo.map(k => renderOtherCountry(k.podiel, k.krajina)).join('');

  const incomePo = `<InSlovakia>${formData.prijmovyPodielSKPo}</InSlovakia>`
    + formData.prijmovePodielyIneKrajinyPo.map(k => renderOtherCountry(k.podiel, k.krajina)).join('');

  const previousPeriods = formData.predchadzajucePrijmy.map(p => `
        <PreviousPeriod><Year>${p.rok}</Year><Income>${p.prijem}</Income></PreviousPeriod>`).join('');

  const naceItem = NACE_CATEGORIES.find(n => n.name === formData.skNace)
    || NACE_CATEGORIES.find(n => n.code === 'G')!;
  const branch = BRANCH_OFFICES.find(b => b.code === formData.pobocka)
    || { code: formData.pobocka, name: formData.pobocka };

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<ApplicationForDeterminationOfApplicableLegislationForSZCO xmlns="http://schemas.gov.sk/form/30807484.Ziadost_o_urcenie_uplatnitelnej_legislativy_osobe_SZCO.sk.pda/12.0">
  <Applicant>
    <PersonData>
      <PhysicalPerson>
        <PersonName>
          <GivenName>${esc(formData.meno)}</GivenName>
          <FamilyName>${esc(formData.priezvisko)}</FamilyName>
          <GivenFamilyName>${esc(formData.rodnePriezvisko || formData.priezvisko)}</GivenFamilyName>
          ${formData.titulPred ? `<Affix position="prefix"><NonCodelistData>${esc(formData.titulPred)}</NonCodelistData></Affix>` : ''}
          ${formData.titulZa ? `<Affix position="postfix"><NonCodelistData>${esc(formData.titulZa)}</NonCodelistData></Affix>` : ''}
        </PersonName>
        <Birth>
          <DateOfBirth>${esc(formData.datumNarodenia)}</DateOfBirth>
          <BirthPlace>${esc(formData.miestoNarodenia || formData.adresaPobytu.obec)}</BirthPlace>
          ${codelist('BirthCountry', 'CL000086', countryCode(formData.statNarodenia), formData.statNarodenia)}
        </Birth>
        ${codelist('Nationality', 'CL010131', countryCode(formData.statnaPrislusnost), formData.statnaPrislusnost)}
        ${codelist('Gender', 'CL003003', formData.pohlavie === 'Žena' ? '2' : '1', formData.pohlavie === 'Žena' ? 'žena' : 'muž')}
      </PhysicalPerson>
      <PhysicalAddress>
        <Municipality>${esc(formData.adresaPobytu.obec)}</Municipality>
        <StreetName>${esc(formData.adresaPobytu.ulica)}</StreetName>
        <BuildingNumber>${esc(formData.adresaPobytu.orientacneCislo)}</BuildingNumber>
        <PropertyRegistrationNumber>${esc(formData.adresaPobytu.supisneCislo)}</PropertyRegistrationNumber>
        <DeliveryAddress><PostalCode>${esc(formData.adresaPobytu.psc.replace(/\s/g, ''))}</PostalCode></DeliveryAddress>
        ${codelist('Country', 'CL000086', countryCode(formData.adresaPobytu.stat), formData.adresaPobytu.stat)}
      </PhysicalAddress>
      <ID>
        <IdentifierType><Codelist><CodelistCode>CL004001</CodelistCode><CodelistItem><ItemCode>9</ItemCode><ItemName>Rodné číslo</ItemName></CodelistItem></Codelist></IdentifierType>
        <IdentifierValue>${esc(formData.rodneCislo.replace(/\//g, ''))}</IdentifierValue>
      </ID>
      <TelephoneAddress><Number><FormattedNumber>${esc(formData.telefon)}</FormattedNumber></Number></TelephoneAddress>
      <ElectronicAddress><InternetAddress><Address>mailto:${esc(formData.email)}</Address></InternetAddress></ElectronicAddress>
    </PersonData>
    <ResidencePermit>${formData.pobytovyPreukaz}</ResidencePermit>
    <Activity>
      <Start>${esc(formData.ziadostOd)}</Start>
      <End>${esc(formData.ziadostDo)}</End>
    </Activity>
    <RepeatMultipleApplication>${formData.opakovanaZiadost}</RepeatMultipleApplication>
    ${formData.datumZdravPoistenia ? `<HealthInsuranceDate>${esc(formData.datumZdravPoistenia)}</HealthInsuranceDate>` : ''}
  </Applicant>
  <TradeCertificate>
    <PersonData>
      <CorporateBody><CorporateBodyFullName>${esc(formData.obchodneMeno)}</CorporateBodyFullName></CorporateBody>
      <PhysicalAddress>
        <Municipality>${esc(formData.adresaMiestaPodnikania.obec)}</Municipality>
        <StreetName>${esc(formData.adresaMiestaPodnikania.ulica)}</StreetName>
        <BuildingNumber>${esc(formData.adresaMiestaPodnikania.orientacneCislo)}</BuildingNumber>
        <PropertyRegistrationNumber>${esc(formData.adresaMiestaPodnikania.supisneCislo)}</PropertyRegistrationNumber>
        <DeliveryAddress><PostalCode>${esc(formData.adresaMiestaPodnikania.psc.replace(/\s/g, ''))}</PostalCode></DeliveryAddress>
      </PhysicalAddress>
      <ID>
        <IdentifierType><Codelist><CodelistCode>CL004001</CodelistCode><CodelistItem><ItemCode>7</ItemCode><ItemName>IČO (Identifikačné číslo organizácie)</ItemName></CodelistItem></Codelist></IdentifierType>
        <IdentifierValue>${esc(formData.ico)}</IdentifierValue>
      </ID>
    </PersonData>
    ${codelist('PlaceOfBusiness', 'CL000086', countryCode(formData.krajinaSidla), formData.krajinaSidla)}
    <Activity>
      <Period>
        <Start>${esc(formData.cinnostOd)}</Start>
        <End>${esc(formData.cinnostDo)}</End>
      </Period>
    </Activity>
    <WorkingTime>${esc(formData.pracovnyCas)}</WorkingTime>
    <SubjectOfSzco>${esc(formData.predmetSZCO)}</SubjectOfSzco>
    ${codelist('ActivityInHeadOffice', 'CL000086', activityCode, activityName)}
    ${formData.typVykonu === 'aj_ine' && (formData.miestaVykonu.length > 0 || formData.krajinyVykonu.length > 0) ? `
    <PlaceOfActivity>
      ${formData.miestaVykonu.length > 0 ? `<PlaceOfActivityLocations>${locations}</PlaceOfActivityLocations>` : ''}
      ${formData.krajinyVykonu.length > 0 ? `<PlaceOfActivityCountries>${countriesXml}</PlaceOfActivityCountries>` : ''}
    </PlaceOfActivity>` : ''}
    <Earnings>
      <CurrentPeriod>
        <Year>${formData.prijemAktualnyRokCislo || new Date().getFullYear()}</Year>
        <Income>${formData.prijemAktualnyRok}</Income>
      </CurrentPeriod>
      ${previousPeriods ? `<PreviousPeriods>${previousPeriods}</PreviousPeriods>` : ''}
    </Earnings>
    <PreviousWorkTimePercentage>${workTimePred}</PreviousWorkTimePercentage>
    <PreviousWorkTimePercentageAfterApplication>${workTimePo}</PreviousWorkTimePercentageAfterApplication>
    <IncomePercentageAfterApplication>${incomePo}</IncomePercentageAfterApplication>
    ${codelist('EconomicClassification', 'ICL001013', naceItem.code, naceItem.name)}
  </TradeCertificate>
  <OtherInformationSZCO>
    ${codelist('PermanentBusinessResidence', 'CL000086', countryCode(formData.krajinaSidla), formData.krajinaSidla)}
    ${formData.vydanyVInejKrajine ? `
    <OtherCountryIssue>
      <Value>true</Value>
      <Document>
        <IssueDate>
          <Start>${esc(formData.vydanyVInejKrajineOd)}</Start>
          <End>${esc(formData.vydanyVInejKrajineDo)}</End>
        </IssueDate>
        <DayOfIssue>${esc(formData.vydanyVInejKrajineDatum)}</DayOfIssue>
        <Institution>${esc(formData.vydanyVInejKrajineInstitucia)}</Institution>
      </Document>
    </OtherCountryIssue>` : `<OtherCountryIssue><Value>false</Value></OtherCountryIssue>`}
    ${formData.doplnujuceInfo ? `<AdditionalInfo>${esc(formData.doplnujuceInfo)}</AdditionalInfo>` : ''}
  </OtherInformationSZCO>
  <Date>${today}</Date>
  <Declaration><TrueData>true</TrueData></Declaration>
  <BranchOffice>
    <Codelist>
      <CodelistCode>ICL001013</CodelistCode>
      <CodelistItem>
        <ItemCode>${esc(branch.code)}</ItemCode>
        <ItemName>${esc(branch.name)}</ItemName>
      </CodelistItem>
    </Codelist>
  </BranchOffice>
  <IsForeigner>${formData.isForeigner}</IsForeigner>
</ApplicationForDeterminationOfApplicableLegislationForSZCO>`;

  const blob = new Blob([xml], { type: 'application/xml' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `ziadost-uplatnitelna-legislativa-${formData.priezvisko || 'szco'}.xml`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};
