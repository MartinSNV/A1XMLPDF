
// Import React to fix namespace errors
import React, { useState, useEffect } from 'react';
import { FormDataState, Address } from '../types';
import { BRANCH_OFFICE_BY_PSC } from '../psc_mapping';

// --- Typy pre RPO API odpoveď ---
interface RpoActivity {
    economicActivityDescription: string;
    validFrom: string;
    validTo?: string | null;
}

interface RpoAddress {
    street?: string;
    regNumber?: string | number;
    buildingNumber?: string | number;
    municipality?: { value: string };
    postalCodes?: string[];
    country?: { value: string };
}

interface RpoPersonName {
    givenNames?: string[];
    familyNames?: string[];
    givenFamilyNames?: string[];
}

interface RpoStatutoryBody {
    personName?: RpoPersonName;
    address?: RpoAddress;
}

interface RpoEntity {
    fullNames?: { value: string }[];
    establishment?: string;
    activities?: RpoActivity[];
    addresses?: RpoAddress[];
    statutoryBodies?: RpoStatutoryBody[];
}

// --- Pomocné funkcie ---

const emptyAddress: Address = {
    ulica: '',
    supisneCislo: '',
    orientacneCislo: '',
    obec: '',
    psc: '',
    stat: 'Slovenská republika',
};

function mapRpoAddress(addr: RpoAddress): Address {
    return {
        ulica: addr.street || '',
        supisneCislo: addr.regNumber?.toString() || '',
        orientacneCislo: addr.buildingNumber?.toString() || '',
        obec: addr.municipality?.value || '',
        psc: addr.postalCodes?.[0] || '',
        stat: addr.country?.value || 'Slovenská republika',
    };
}

export const useRpo = (ico: string, setFormData: React.Dispatch<React.SetStateAction<FormDataState>>) => {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);

    useEffect(() => {
        const cleanIco = ico.trim().replace(/\s/g, '');
        
        const handler = setTimeout(async () => {
            if (!cleanIco) {
                setError(null);
                setSuccess(false);
                setLoading(false);
                return;
            }

            if (!/^\d{8}$/.test(cleanIco)) {
                setError('IČO musí mať 8 číslic.');
                setSuccess(false);
                setLoading(false);
                return;
            }

            setError(null);
            setLoading(true);
            setSuccess(false);
            console.log(`[RPO Debug] Starting search for ICO: ${cleanIco}`);

            try {
                // Jedno volanie — proxy server vykoná search + detail interne
                const response = await fetch(`/api/rpo/entity?ico=${cleanIco}`);

                if (!response.ok) {
                    const errData = await response.json().catch(() => ({}));
                    throw new Error(
                        `Chyba RPO: ${errData.details || errData.error || response.statusText} (${response.status})`
                    );
                }

                const entity: RpoEntity = await response.json();
                console.log('[RPO] Dáta entity:', entity);

                // --- Mapovanie dát ---
                const obchodneMeno = entity.fullNames?.[0]?.value || '';
                const datumZaciatkuCinnosti = entity.establishment || '';

                const activeActivities: string[] = (entity.activities || [])
                    .filter(a => a.economicActivityDescription && a.validFrom && !a.validTo)
                    .map(a => a.economicActivityDescription);

                const adresaMiestaPodnikania: Address = entity.addresses?.[0]
                    ? mapRpoAddress(entity.addresses[0])
                    : { ...emptyAddress };

                setFormData(prev => {
                    const newState = { ...prev };
                    newState.obchodneMeno = obchodneMeno;
                    newState.datumZaciatkuCinnosti = datumZaciatkuCinnosti;
                    newState.dostupneCinnosti = activeActivities;
                    
                    // Pre-fill only if exactly one activity is found and field is empty
                    if (activeActivities.length === 1 && !newState.cinnostSZCONaSlovensku) {
                        newState.cinnostSZCONaSlovensku = activeActivities[0];
                    }
                    
                    newState.adresaMiestaPodnikania = adresaMiestaPodnikania;
                    newState.zadatAdresuMiestaPodnikania = !!entity.addresses?.[0];

                    // Extrakcia údajov o fyzickej osobe (štatutár/podnikateľ)
                    const statutory = entity.statutoryBodies?.[0];
                    if (statutory && statutory.personName) {
                        const pn = statutory.personName;
                        newState.meno = pn.givenNames?.[0] || newState.meno;
                        newState.priezvisko = pn.familyNames?.[0] || newState.priezvisko;
                        newState.rodnePriezvisko = pn.givenFamilyNames?.[0] || newState.rodnePriezvisko;
                        
                        // Adresa trvalého pobytu štatutára
                        if (statutory.address) {
                            newState.adresaPobytu = mapRpoAddress(statutory.address);
                            
                            // Auto-select branch based on PSC
                            if (newState.adresaPobytu.psc) {
                                const cleanPsc = newState.adresaPobytu.psc.replace(/\s/g, '');
                                const branchCode = BRANCH_OFFICE_BY_PSC[cleanPsc];
                                if (branchCode) {
                                    newState.pobocka = branchCode;
                                }
                            }
                        }
                    }

                    return newState;
                });

                setSuccess(true);
                setTimeout(() => setSuccess(false), 2000);
            } catch (err) {
                console.error('RPO Fetch Error:', err);
                setError(err instanceof Error ? err.message : 'Chyba pri získavaní údajov.');
            } finally {
                setLoading(false);
            }
        }, 600); 

        return () => clearTimeout(handler);
    }, [ico, setFormData]);

    return { loading, error, success };
};
