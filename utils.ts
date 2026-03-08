
import { FormDataState, Address } from './types';
import { COUNTRY_MAP, NACE_CATEGORIES } from './constants';

export const escapeXml = (unsafe: string): string => {
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

export const parseBirthDateFromRc = (rc: string): string | null => {
  const cleanRc = rc.replace(/\D/g, '');
  if (cleanRc.length < 6) return null;
  let monthPart = parseInt(cleanRc.substring(2, 4), 10);
  if (monthPart > 50) monthPart -= 50;
  const yearPart = parseInt(cleanRc.substring(0, 2), 10);
  const dayPart = parseInt(cleanRc.substring(4, 6), 10);
  const currentYear = new Date().getFullYear() % 100;
  const year = yearPart > currentYear ? 1900 + yearPart : 2000 + yearPart;
  return `${year}-${monthPart.toString().padStart(2, '0')}-${dayPart.toString().padStart(2, '0')}`;
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

const renderPhysicalAddress = (addr: Address) => `
    <PhysicalAddress>
      <Municipality>${escapeXml(addr.obec)}</Municipality>
      <StreetName>${escapeXml(addr.ulica)}</StreetName>
      <BuildingNumber>${escapeXml(addr.orientacneCislo)}</BuildingNumber>
      <PropertyRegistrationNumber>${escapeXml(addr.supisneCislo)}</PropertyRegistrationNumber>
      <DeliveryAddress>
        <PostalCode>${escapeXml(addr.psc.replace(/\s/g, ''))}</PostalCode>
      </DeliveryAddress>
      ${renderCodelist('Country', 'CL000086', COUNTRY_MAP[addr.stat] || '703', addr.stat)}
    </PhysicalAddress>`;

const renderAffix = (tagName: string, position: string, value: string, codelistCode: string) => {
  if (!value) return '';
  // Simple mapping for common titles to codes (not exhaustive but better than hardcoded 01)
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

export const generateA1Xml = (formData: FormDataState): void => {
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
          <BirthPlace>${escapeXml(formData.miestoNarodenia || formData.adresaPobytu.obec)}</BirthPlace>
          ${renderCodelist('BirthCountry', 'CL000086', COUNTRY_MAP[formData.statNarodenia] || '703', formData.statNarodenia)}
        </Birth>
        ${renderCodelist('Nationality', 'CL010131', COUNTRY_MAP[formData.statnaPrislusnost] || '703', formData.statnaPrislusnost)}
        ${renderCodelist('Gender', 'CL003003', formData.pohlavie === 'Žena' ? '2' : '1', formData.pohlavie === 'Žena' ? 'žena' : 'muž')}
      </PhysicalPerson>
      ${renderPhysicalAddress(formData.adresaPobytu)}
      <ID>
        <IdentifierType>
          <Codelist>
            <CodelistCode>CL004001</CodelistCode>
            <CodelistItem>
              <ItemCode>9</ItemCode>
              <ItemName>Rodné číslo</ItemName>
            </CodelistItem>
          </Codelist>
        </IdentifierType>
        <IdentifierValue>${escapeXml(formData.rodneCislo.replace(/\//g, ''))}</IdentifierValue>
      </ID>
      <TelephoneAddress>
        <Number><FormattedNumber>${escapeXml(formData.telefon)}</FormattedNumber></Number>
      </TelephoneAddress>
      <ElectronicAddress>
        <InternetAddress><Address>mailto:${escapeXml(formData.email)}</Address></InternetAddress>
      </ElectronicAddress>
    </PersonData>
    <ResidencePermit>${formData.pobytovyPreukaz}</ResidencePermit>
  </Applicant>
  <Posting>
    <PersonData>
      <CorporateBody>
        <CorporateBodyFullName>${escapeXml(formData.obchodneMeno)}</CorporateBodyFullName>
      </CorporateBody>
      ${renderPhysicalAddress(formData.adresaMiestaPodnikania.ulica ? formData.adresaMiestaPodnikania : formData.adresaPobytu)}
      <ID>
        ${renderCodelist('IdentifierType', 'CL004001', '7', 'IČO (Identifikačné číslo organizácie)')}
        <IdentifierValue>${escapeXml(formData.ico)}</IdentifierValue>
      </ID>
    </PersonData>
    <SzcoDateStart>${escapeXml(formData.datumZaciatkuCinnosti)}</SzcoDateStart>
    <SZCO>
      <ActivityBeforeSending>${escapeXml(formData.cinnostSZCONaSlovensku)}</ActivityBeforeSending>
      <ActivityDuringSending>${escapeXml(formData.popisCinnosti)}</ActivityDuringSending>
      <EndingOfSending>true</EndingOfSending>
      <RetainingPremises>true</RetainingPremises>
    </SZCO>
    <Places>
      ${renderCodelist('Country', 'CL000086', COUNTRY_MAP[formData.statVyslania] || '276', formData.statVyslania)}
      <Place>
        <PersonData>
          <CorporateBody>
            <CorporateBodyFullName>${escapeXml(formData.obchodneMenoPrijimajucejOsoby)}</CorporateBodyFullName>
          </CorporateBody>
          ${renderPhysicalAddress(formData.adresaVyslania)}
          <ID>
            <IdentifierType>
              <Codelist>
                <CodelistCode>CL004001</CodelistCode>
                <CodelistItem>
                  <ItemCode>7</ItemCode>
                  <ItemName>IČO (Identifikačné číslo organizácie)</ItemName>
                </CodelistItem>
              </Codelist>
            </IdentifierType>
            <IdentifierValue>${escapeXml(formData.icoPrijimajucejOsoby || '00000000')}</IdentifierValue>
          </ID>
        </PersonData>
      </Place>
      ${formData.dalsieMiestaVyslania && formData.dalsieMiestaVyslania.map(miesto => `
      <Place>
        <PersonData>
          ${renderPhysicalAddress(miesto)}
        </PersonData>
      </Place>
      `).join('')}
    </Places>
    <SendingDuration>
      <Start>${escapeXml(formData.datumZaciatkuVyslania)}</Start>
      <End>${escapeXml(formData.datumKoncaVyslania)}</End>
    </SendingDuration>
    ${(() => {
      const nace = NACE_CATEGORIES.find(n => n.code === formData.skNace);
      return renderCodelist('EconomicClassification', 'ICL001013', formData.skNace || 'F', nace ? nace.name : 'F – Stavebníctvo');
    })()}
    <DocumentIssued><Value>false</Value></DocumentIssued>
  </Posting>
  <OtherInformation>
    <OtherCountryIssue><Value>false</Value></OtherCountryIssue>
    <AdditionalInfo>${escapeXml(formData.poznamka)}</AdditionalInfo>
  </OtherInformation>
  <Date>${today}</Date>
  <Declaration>
    <TrueData>true</TrueData>
  </Declaration>
  <ContactBranchOffice>
     ${renderCodelist('Codelist', 'ICL001013', formData.pobocka || 'BA', 'Bratislava')}
  </ContactBranchOffice>
  <IsForeigner>${formData.isForeigner}</IsForeigner>
</ApplicationForTheIssueOfAPortableDocumentDueToSzcoPosting>`.trim();

  const blob = new Blob([xmlContent], { type: 'application/xml;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `ziadost_a1_${formData.priezvisko.toLowerCase()}.xml`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};
