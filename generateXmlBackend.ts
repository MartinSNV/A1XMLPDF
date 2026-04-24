// generateXmlBackend.ts
// Backend verzia XML generátorov — vracia string namiesto browser downloadu
// Používa sa v admin rozhraní pri generovaní XML zo žiadostí uložených v DB

import { COUNTRY_MAP, NACE_CATEGORIES, BRANCH_OFFICES } from './constants.js';

// ── Spoločné pomocné funkcie ─────────────────────────────────────────────────

const escapeXml = (unsafe: string): string => {
  if (typeof unsafe !== 'string') return '';
  return unsafe.replace(/[<>&'"]/g, (c) => {
    switch (c) {
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '&': return '&amp;';
      case '\'': return '&apos;';
      case '"': return '&quot;';
      default: return c;
    }
  });
};

const renderCodelist = (tagName: string, codelistCode: string, itemCode: string, itemName: string) => `
    <${tagName}>
      <Codelist>
        <CodelistCode>${codelistCode}</CodelistCode>
        <CodelistItem>
          <ItemCode>${itemCode}</ItemCode>
          <ItemName>${escapeXml(itemName)}</ItemName>
        </CodelistItem>
      </Codelist>
    </${tagName}>`;

const renderPhysicalAddress = (addr: any) => `
    <PhysicalAddress>
      <Municipality>${escapeXml(addr.obec || '')}</Municipality>
      <StreetName>${escapeXml(addr.ulica || '')}</StreetName>
      <BuildingNumber>${escapeXml(addr.orientacneCislo || '')}</BuildingNumber>
      <PropertyRegistrationNumber>${escapeXml(addr.supisneCislo || '')}</PropertyRegistrationNumber>
      <DeliveryAddress>
        <PostalCode>${escapeXml((addr.psc || '').replace(/\s/g, ''))}</PostalCode>
      </DeliveryAddress>
      ${renderCodelist('Country', 'CL000086', COUNTRY_MAP[addr.stat] || '703', addr.stat || '')}
    </PhysicalAddress>`;

const renderAffix = (tagName: string, position: string, value: string, codelistCode: string) => {
  if (!value) return '';
  const titleMap: Record<string, string> = {
    'Bc.': '01', 'Mgr.': '02', 'Ing.': '03', 'MUDr.': '04', 'MVDr.': '05',
    'PaedDr.': '06', 'PharmDr.': '07', 'PhDr.': '08', 'JUDr.': '09', 'RNDr.': '10',
    'ThDr.': '11', 'doc.': '12', 'prof.': '13',
    'PhD.': '01', 'CSc.': '02', 'DrSc.': '03', 'MBA': '04', 'MPH': '05', 'LL.M.': '06'
  };
  const itemCode = titleMap[value] || '01';
  return `
    <Affix position="${position}">
      <Codelist>
        <CodelistCode>${codelistCode}</CodelistCode>
        <CodelistItem>
          <ItemCode>${itemCode}</ItemCode>
          <ItemName>${escapeXml(value)}</ItemName>
        </CodelistItem>
      </Codelist>
    </Affix>`;
};

// ── PD A1 – Vyslanie ─────────────────────────────────────────────────────────

export const generateA1XmlString = (formData: any): string => {
  const today = new Date().toISOString().split('T')[0];

  const xmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<ApplicationForTheIssueOfAPortableDocumentDueToSzcoPosting xmlns="http://schemas.gov.sk/form/30807484.Ziadost_o_vystavenie_prenosneho_dokumentu_A1_z_dovodu_vyslania_SZCO.sk.pda/12.0">
  <Applicant>
    <PersonData>
      <PhysicalPerson>
        <PersonName>
          <GivenName>${escapeXml(formData.meno)}</GivenName>
          <FamilyName>${escapeXml(formData.priezvisko)}</FamilyName>
          <GivenFamilyName>${escapeXml(formData.rodnePriezvisko || formData.priezvisko)}</GivenFamilyName>
          ${renderAffix('Affix', 'prefix', formData.titulPred, 'CL000062')}
          ${renderAffix('Affix', 'postfix', formData.titulZa, 'CL000063')}
        </PersonName>
        <Birth>
          <DateOfBirth>${escapeXml(formData.datumNarodenia)}</DateOfBirth>
          <BirthPlace>${escapeXml(formData.miestoNarodenia || formData.adresaPobytu?.obec || '')}</BirthPlace>
          ${renderCodelist('BirthCountry', 'CL000086', COUNTRY_MAP[formData.statNarodenia] || '703', formData.statNarodenia)}
        </Birth>
        ${renderCodelist('Nationality', 'CL010131', COUNTRY_MAP[formData.statnaPrislusnost] || '703', formData.statnaPrislusnost)}
        ${renderCodelist('Gender', 'CL003003', formData.pohlavie === 'Žena' ? '2' : '1', formData.pohlavie === 'Žena' ? 'žena' : 'muž')}
      </PhysicalPerson>
      ${renderPhysicalAddress(formData.adresaPobytu || {})}
      <ID>
        <IdentifierType>
          <Codelist>
            <CodelistCode>CL004001</CodelistCode>
            <CodelistItem><ItemCode>9</ItemCode><ItemName>Rodné číslo</ItemName></CodelistItem>
          </Codelist>
        </IdentifierType>
        <IdentifierValue>${escapeXml((formData.rodneCislo || '').replace(/\//g, ''))}</IdentifierValue>
      </ID>
      <TelephoneAddress><Number><FormattedNumber>${escapeXml(formData.telefon)}</FormattedNumber></Number></TelephoneAddress>
      <ElectronicAddress><InternetAddress><Address>mailto:${escapeXml(formData.email)}</Address></InternetAddress></ElectronicAddress>
    </PersonData>
    <ResidencePermit>${formData.pobytovyPreukaz}</ResidencePermit>
  </Applicant>
  <Posting>
    <PersonData>
      <CorporateBody><CorporateBodyFullName>${escapeXml(formData.obchodneMeno)}</CorporateBodyFullName></CorporateBody>
      ${renderPhysicalAddress(formData.adresaMiestaPodnikania?.ulica ? formData.adresaMiestaPodnikania : formData.adresaPobytu || {})}
      <ID>
        ${renderCodelist('IdentifierType', 'CL004001', '7', 'IČO (Identifikačné číslo organizácie)')}
        <IdentifierValue>${escapeXml(formData.ico)}</IdentifierValue>
      </ID>
    </PersonData>
    <SzcoDateStart>${escapeXml(formData.datumZaciatkuCinnosti)}</SzcoDateStart>
    ${formData.prerusenieZivnosti ? `
    <Suspension>
      <SuspensionValue>true</SuspensionValue>
      <Period>
        <Start>${escapeXml(formData.prerusenieOd)}</Start>
        <End>${escapeXml(formData.prerusenieDo)}</End>
      </Period>
    </Suspension>` : `<Suspension><SuspensionValue>false</SuspensionValue></Suspension>`}
    <SZCO>
      <ActivityBeforeSending>${escapeXml(formData.cinnostSZCONaSlovensku)}</ActivityBeforeSending>
      <ActivityDuringSending>${escapeXml(formData.popisCinnosti)}</ActivityDuringSending>
      <EndingOfSending>${formData.obvykleMiestoVykonuCinnosti}</EndingOfSending>
      <RetainingPremises>${formData.zachovaPriestory}</RetainingPremises>
    </SZCO>
    <RealActivityInSlovakia>
      <Start>${escapeXml(formData.skutocnaCinnostOd || formData.datumZaciatkuCinnosti)}</Start>
      <End>${escapeXml(formData.skutocnaCinnostDo || formData.datumZaciatkuVyslania)}</End>
      <Amount>${escapeXml(formData.skutocnaCinnostHodinMesacne || '0')}</Amount>
    </RealActivityInSlovakia>
    <Places>
      ${renderCodelist('Country', 'CL000086', COUNTRY_MAP[formData.statVyslania] || '276', formData.statVyslania)}
      <Place>
        <PersonData>
          <CorporateBody><CorporateBodyFullName>${escapeXml(formData.obchodneMenoPrijimajucejOsoby)}</CorporateBodyFullName></CorporateBody>
          ${renderPhysicalAddress(formData.adresaVyslania || {})}
          <ID>
            <IdentifierType><Codelist><CodelistCode>CL004001</CodelistCode><CodelistItem><ItemCode>7</ItemCode><ItemName>IČO</ItemName></CodelistItem></Codelist></IdentifierType>
            <IdentifierValue>${escapeXml(formData.icoPrijimajucejOsoby || '-')}</IdentifierValue>
          </ID>
        </PersonData>
      </Place>
      ${(formData.dalsieMiestaVyslania || []).map((miesto: any) => `
      <Place>
        <PersonData>
          <CorporateBody><CorporateBodyFullName>${escapeXml(miesto.obchodneMeno)}</CorporateBodyFullName></CorporateBody>
          ${renderPhysicalAddress(miesto.adresa || {})}
          <ID>
            <IdentifierType><Codelist><CodelistCode>CL004001</CodelistCode><CodelistItem><ItemCode>7</ItemCode><ItemName>IČO</ItemName></CodelistItem></Codelist></IdentifierType>
            <IdentifierValue>${escapeXml(miesto.ico || '-')}</IdentifierValue>
          </ID>
        </PersonData>
      </Place>`).join('')}
    </Places>
    <SendingDuration>
      <Start>${escapeXml(formData.datumZaciatkuVyslania)}</Start>
      <End>${escapeXml(formData.datumKoncaVyslania)}</End>
    </SendingDuration>
    ${formData.cinnostVStatePredVyslanim ? `
    <PreviousSendingToState>
      <Value>true</Value>
      <Period>
        <Start>${escapeXml(formData.cinnostVStatePredOd)}</Start>
        <End>${escapeXml(formData.cinnostVStatePredDo)}</End>
      </Period>
    </PreviousSendingToState>` : `<PreviousSendingToState><Value>false</Value></PreviousSendingToState>`}
    ${(() => {
      const nace = NACE_CATEGORIES.find((n: any) => n.code === formData.skNace);
      return renderCodelist('EconomicClassification', 'ICL001013', formData.skNace || 'F', nace ? nace.name : 'F – Stavebníctvo');
    })()}
    <DocumentIssued><Value>false</Value></DocumentIssued>
  </Posting>
  <OtherInformation>
    ${formData.vydanyVInejKrajine ? `
    <OtherCountryIssue>
      <Value>true</Value>
      <Document>
        <IssueDate>
          <Start>${escapeXml(formData.vydanyVInejKrajineOd)}</Start>
          <End>${escapeXml(formData.vydanyVInejKrajineDo)}</End>
        </IssueDate>
        <DayOfIssue>${escapeXml(formData.vydanyVInejKrajineDatum)}</DayOfIssue>
        <Institution>${escapeXml(formData.vydanyVInejKrajineInstitucia)}</Institution>
      </Document>
    </OtherCountryIssue>` : `<OtherCountryIssue><Value>false</Value></OtherCountryIssue>`}
    ${formData.poznamka ? `<AdditionalInfo>${escapeXml(formData.poznamka)}</AdditionalInfo>` : ''}
  </OtherInformation>
  <Date>${today}</Date>
  <Declaration><TrueData>true</TrueData></Declaration>
  <ContactBranchOffice>
    ${renderCodelist('Codelist', 'ICL001013', formData.pobocka || 'BA', 'Bratislava')}
  </ContactBranchOffice>
  <IsForeigner>${formData.isForeigner}</IsForeigner>
</ApplicationForTheIssueOfAPortableDocumentDueToSzcoPosting>`.trim();

  return xmlContent;
};

// ── Uplatniteľná legislatíva ──────────────────────────────────────────────────

const esc = escapeXml;
const countryCode = (name: string) => COUNTRY_MAP[name] || '703';
const codelist = (tag: string, codelistCode: string, itemCode: string, itemName: string) =>
  tag
    ? `<${tag}><Codelist><CodelistCode>${codelistCode}</CodelistCode><CodelistItem><ItemCode>${itemCode}</ItemCode><ItemName>${esc(itemName)}</ItemName></CodelistItem></Codelist></${tag}>`
    : `<Codelist><CodelistCode>${codelistCode}</CodelistCode><CodelistItem><ItemCode>${itemCode}</ItemCode><ItemName>${esc(itemName)}</ItemName></CodelistItem></Codelist>`;

export const generateUplatnitelnaXmlString = (formData: any): string => {
  const today = new Date().toISOString().split('T')[0];

  const activityCode = formData.typVykonu === 'iba_sr' ? '1' : '2';
  const activityName = formData.typVykonu === 'iba_sr'
    ? 'Samostatnú zárobkovú činnosť vykonávam iba v sídle'
    : 'Samostatnú zárobkovú činnosť vykonávam okrem sídla aj z inej adresy, resp. v inom štáte';

  const locations = (formData.miestaVykonu || []).map((m: any) => `
        <Locations>
          <Description>${esc(m.description)}</Description>
          <PhysicalAddress>
            <Municipality>${esc(m.adresa?.obec || '')}</Municipality>
            <StreetName>${esc(m.adresa?.ulica || '')}</StreetName>
            <BuildingNumber>${esc(m.adresa?.orientacneCislo || '')}</BuildingNumber>
            <PropertyRegistrationNumber>${esc(m.adresa?.supisneCislo || '')}</PropertyRegistrationNumber>
            <DeliveryAddress><PostalCode>${esc((m.adresa?.psc || '').replace(/\s/g, ''))}</PostalCode></DeliveryAddress>
            ${codelist('Country', 'CL000086', countryCode(m.adresa?.stat || ''), m.adresa?.stat || '')}
          </PhysicalAddress>
        </Locations>`).join('');

  const countriesXml = (formData.krajinyVykonu || []).map((k: string) => `
        <Countries>
          <Country>${codelist('', 'CL000086', countryCode(k), k)}</Country>
        </Countries>`).join('');

  const renderOtherCountry = (podiel: number, krajina: string) => `
      <OtherCountry>
        <Percentage>${podiel}</Percentage>
        <Name>${codelist('', 'CL000086', countryCode(krajina), krajina)}</Name>
      </OtherCountry>`;

  const workTimePred = `<InSlovakia>${formData.casovyPodielSKPred || 100}</InSlovakia>`
    + (formData.casovePodielyIneKrajinyPred || []).map((k: any) => renderOtherCountry(k.podiel, k.krajina)).join('');

  const workTimePo = `<InSlovakia>${formData.casovyPodielSKPo || 100}</InSlovakia>`
    + (formData.casovePodielyIneKrajinyPo || []).map((k: any) => renderOtherCountry(k.podiel, k.krajina)).join('');

  const incomePo = `<InSlovakia>${formData.prijmovyPodielSKPo || 100}</InSlovakia>`
    + (formData.prijmovePodielyIneKrajinyPo || []).map((k: any) => renderOtherCountry(k.podiel, k.krajina)).join('');

  const previousPeriods = (formData.predchadzajucePrijmy || []).map((p: any) => `
        <PreviousPeriod><Year>${p.rok}</Year><Income>${p.prijem}</Income></PreviousPeriod>`).join('');

  const naceItem = NACE_CATEGORIES.find((n: any) => n.name === formData.skNace)
    || NACE_CATEGORIES.find((n: any) => n.code === 'G')!;
  const branch = BRANCH_OFFICES.find((b: any) => b.code === formData.pobocka)
    || { code: formData.pobocka || 'BA', name: formData.pobocka || 'BA' };

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
          <BirthPlace>${esc(formData.miestoNarodenia || formData.adresaPobytu?.obec || '')}</BirthPlace>
          ${codelist('BirthCountry', 'CL000086', countryCode(formData.statNarodenia), formData.statNarodenia)}
        </Birth>
        ${codelist('Nationality', 'CL010131', countryCode(formData.statnaPrislusnost), formData.statnaPrislusnost)}
        ${codelist('Gender', 'CL003003', formData.pohlavie === 'Žena' ? '2' : '1', formData.pohlavie === 'Žena' ? 'žena' : 'muž')}
      </PhysicalPerson>
      <PhysicalAddress>
        <Municipality>${esc(formData.adresaPobytu?.obec || '')}</Municipality>
        <StreetName>${esc(formData.adresaPobytu?.ulica || '')}</StreetName>
        <BuildingNumber>${esc(formData.adresaPobytu?.orientacneCislo || '')}</BuildingNumber>
        <PropertyRegistrationNumber>${esc(formData.adresaPobytu?.supisneCislo || '')}</PropertyRegistrationNumber>
        <DeliveryAddress><PostalCode>${esc((formData.adresaPobytu?.psc || '').replace(/\s/g, ''))}</PostalCode></DeliveryAddress>
        ${codelist('Country', 'CL000086', countryCode(formData.adresaPobytu?.stat || ''), formData.adresaPobytu?.stat || '')}
      </PhysicalAddress>
      <ID>
        <IdentifierType><Codelist><CodelistCode>CL004001</CodelistCode><CodelistItem><ItemCode>9</ItemCode><ItemName>Rodné číslo</ItemName></CodelistItem></Codelist></IdentifierType>
        <IdentifierValue>${esc((formData.rodneCislo || '').replace(/\//g, ''))}</IdentifierValue>
      </ID>
      <TelephoneAddress><Number><FormattedNumber>${esc(formData.telefon)}</FormattedNumber></Number></TelephoneAddress>
      <ElectronicAddress><InternetAddress><Address>mailto:${esc(formData.email)}</Address></InternetAddress></ElectronicAddress>
    </PersonData>
    <ResidencePermit>${formData.pobytovyPreukaz || false}</ResidencePermit>
    <Activity>
      <Start>${esc(formData.ziadostOd)}</Start>
      <End>${esc(formData.ziadostDo)}</End>
    </Activity>
    <RepeatMultipleApplication>${formData.opakovanaZiadost || false}</RepeatMultipleApplication>
    ${formData.datumZdravPoistenia ? `<HealthInsuranceDate>${esc(formData.datumZdravPoistenia)}</HealthInsuranceDate>` : ''}
  </Applicant>
  <TradeCertificate>
    <PersonData>
      <CorporateBody><CorporateBodyFullName>${esc(formData.obchodneMeno)}</CorporateBodyFullName></CorporateBody>
      <PhysicalAddress>
        <Municipality>${esc(formData.adresaMiestaPodnikania?.obec || '')}</Municipality>
        <StreetName>${esc(formData.adresaMiestaPodnikania?.ulica || '')}</StreetName>
        <BuildingNumber>${esc(formData.adresaMiestaPodnikania?.orientacneCislo || '')}</BuildingNumber>
        <PropertyRegistrationNumber>${esc(formData.adresaMiestaPodnikania?.supisneCislo || '')}</PropertyRegistrationNumber>
        <DeliveryAddress><PostalCode>${esc((formData.adresaMiestaPodnikania?.psc || '').replace(/\s/g, ''))}</PostalCode></DeliveryAddress>
      </PhysicalAddress>
      <ID>
        <IdentifierType><Codelist><CodelistCode>CL004001</CodelistCode><CodelistItem><ItemCode>7</ItemCode><ItemName>IČO</ItemName></CodelistItem></Codelist></IdentifierType>
        <IdentifierValue>${esc(formData.ico)}</IdentifierValue>
      </ID>
    </PersonData>
    ${codelist('PlaceOfBusiness', 'CL000086', countryCode(formData.krajinaSidla || 'Slovenská republika'), formData.krajinaSidla || 'Slovenská republika')}
    <Activity>
      <Period>
        <Start>${esc(formData.cinnostOd)}</Start>
        <End>${esc(formData.cinnostDo)}</End>
      </Period>
    </Activity>
    <WorkingTime>${esc(formData.pracovnyCas)}</WorkingTime>
    <SubjectOfSzco>${esc(formData.predmetSZCO)}</SubjectOfSzco>
    ${codelist('ActivityInHeadOffice', 'CL000086', activityCode, activityName)}
    ${formData.typVykonu === 'aj_ine' && ((formData.miestaVykonu || []).length > 0 || (formData.krajinyVykonu || []).length > 0) ? `
    <PlaceOfActivity>
      ${(formData.miestaVykonu || []).length > 0 ? `<PlaceOfActivityLocations>${locations}</PlaceOfActivityLocations>` : ''}
      ${(formData.krajinyVykonu || []).length > 0 ? `<PlaceOfActivityCountries>${countriesXml}</PlaceOfActivityCountries>` : ''}
    </PlaceOfActivity>` : ''}
    <Earnings>
      <CurrentPeriod>
        <Year>${formData.prijemAktualnyRokCislo || new Date().getFullYear()}</Year>
        <Income>${formData.prijemAktualnyRok || 0}</Income>
      </CurrentPeriod>
      ${previousPeriods ? `<PreviousPeriods>${previousPeriods}</PreviousPeriods>` : ''}
    </Earnings>
    <PreviousWorkTimePercentage>${workTimePred}</PreviousWorkTimePercentage>
    <PreviousWorkTimePercentageAfterApplication>${workTimePo}</PreviousWorkTimePercentageAfterApplication>
    <IncomePercentageAfterApplication>${incomePo}</IncomePercentageAfterApplication>
    ${codelist('EconomicClassification', 'ICL001013', naceItem.code, naceItem.name)}
  </TradeCertificate>
  <OtherInformationSZCO>
    ${codelist('PermanentBusinessResidence', 'CL000086', countryCode(formData.krajinaSidla || 'Slovenská republika'), formData.krajinaSidla || 'Slovenská republika')}
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
  <IsForeigner>${formData.isForeigner || false}</IsForeigner>
</ApplicationForDeterminationOfApplicableLegislationForSZCO>`;

  return xml;
};

// ── Hlavná funkcia pre backend ────────────────────────────────────────────────

export const generateXmlFromBundle = (formType: string, formData: any): string => {
  if (formType === 'PD_A1') return generateA1XmlString(formData);
  if (formType === 'UPLATNITELNA_LEGISLATIVA') return generateUplatnitelnaXmlString(formData);
  throw new Error(`Neznámy typ formulára: ${formType}`);
};
