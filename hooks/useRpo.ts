import React, { useState, useEffect } from 'react';
import { FormDataState, Address } from '../types';
import { BRANCH_OFFICE_BY_PSC } from '../psc_mapping';

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
    source?: string;
    fullNames?: { value: string }[];
    establishment?: string;
    activities?: RpoActivity[];
    addresses?: RpoAddress[];
    statutoryBodies?: RpoStatutoryBody[];
    dic?: string;
    icdph?: string;
}

interface RpoDetail {
    source: string;
    activities: RpoActivity[];
    statutoryBodies: RpoStatutoryBody[];
    statisticalCodes: any;
}

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

function applyActivities(activities: RpoActivity[], prev: FormDataState): Partial<FormDataState> {
    const active = activities
        .filter(a => a.economicActivityDescription && a.validFrom && !a.validTo)
        .map(a => a.economicActivityDescription);
    const patch: Partial<FormDataState> = { dostupneCinnosti: active };
    if (active.length === 1 && !prev.cinnostSZCONaSlovensku) {
        patch.cinnostSZCONaSlovensku = active[0];
    }
    return patch;
}

function applyStatutoryBody(statutory: RpoStatutoryBody, prev: FormDataState): Partial<FormDataState> {
    const patch: Partial<FormDataState> = {};
    if (statutory.personName) {
        const pn = statutory.personName;
        patch.meno = pn.givenNames?.[0] || prev.meno;
        patch.priezvisko = pn.familyNames?.[0] || prev.priezvisko;
        patch.rodnePriezvisko = pn.givenFamilyNames?.[0] || prev.rodnePriezvisko;
        if (statutory.address) {
            const addr = mapRpoAddress(statutory.address);
            patch.adresaPobytu = addr;
            const cleanPsc = addr.psc.replace(/\s/g, '');
            const branchCode = BRANCH_OFFICE_BY_PSC[cleanPsc];
            if (branchCode) patch.pobocka = branchCode;
        }
    }
    return patch;
}

export const useRpo = (ico: string, setFormData: React.Dispatch<React.SetStateAction<FormDataState>>) => {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);
    const [loadingDetail, setLoadingDetail] = useState(false);

    useEffect(() => {
        const cleanIco = ico.trim().replace(/\s/g, '');

        // Debounce — wait 1s after user stops typing before calling API
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

            // Retry logic on frontend (handles cases where server itself hits rate limit)
            const MAX_RETRIES = 3;
            let lastError: string | null = null;

            for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
                try {
                    if (attempt > 0) {
                        // Wait before retrying: 2s, 4s, 8s
                        const delay = Math.pow(2, attempt) * 1000;
                        console.log(`[RPO] Retry attempt ${attempt}, waiting ${delay}ms...`);
                        await new Promise(r => setTimeout(r, delay));
                    }

                    const response = await fetch(`/api/rpo/entity?ico=${cleanIco}`);

                    if (response.status === 429) {
                        lastError = 'RPO API je dočasne preťažené (rate limit). Skúšam znova...';
                        console.warn(`[RPO] 429 on attempt ${attempt + 1}`);
                        if (attempt < MAX_RETRIES) continue;
                        throw new Error('RPO API je dočasne preťažené. Skúste zadať IČO znova za chvíľu.');
                    }

                    if (!response.ok) {
                        const errData = await response.json().catch(() => ({}));
                        throw new Error(
                            `Chyba RPO: ${errData.error || errData.details || response.statusText} (${response.status})`
                        );
                    }

                    const entity: RpoEntity = await response.json();
                    console.log('[RPO] Entity data (source:', entity.source, ')');

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
                        newState.adresaMiestaPodnikania = adresaMiestaPodnikania;
                        newState.zadatAdresuMiestaPodnikania = !!entity.addresses?.[0];

                        if (entity.dic) newState.dic = entity.dic;
                        if (entity.icdph) newState.icdph = entity.icdph;

                        if (activeActivities.length === 1 && !newState.cinnostSZCONaSlovensku) {
                            newState.cinnostSZCONaSlovensku = activeActivities[0];
                        }

                        // For non-ORSF sources, statutory body data is already in the entity
                        if (entity.source !== 'ORSF') {
                            const statutory = entity.statutoryBodies?.[0];
                            if (statutory) {
                                Object.assign(newState, applyStatutoryBody(statutory, prev));
                            }
                        }

                        return newState;
                    });

                    setSuccess(true);
                    setTimeout(() => setSuccess(false), 2000);
                    lastError = null;

                    // Progressive: if data came from ORSF (no activities/statutory yet),
                    // fetch RPO detail in background for activities and statutory bodies
                    if (entity.source === 'ORSF') {
                        setLoadingDetail(true);
                        const detailTimeout = setTimeout(() => setLoadingDetail(false), 10000);

                        fetch(`/api/rpo/detail-async?ico=${cleanIco}`)
                            .then(r => r.json())
                            .then((detail: RpoDetail) => {
                                clearTimeout(detailTimeout);
                                setLoadingDetail(false);
                                if (detail.source === 'RPO_FAILED') return;

                                setFormData(prev => {
                                    const newState = { ...prev };

                                    if (detail.activities?.length) {
                                        Object.assign(newState, applyActivities(detail.activities, prev));
                                    }

                                    if (detail.statutoryBodies?.length) {
                                        Object.assign(newState, applyStatutoryBody(detail.statutoryBodies[0], prev));
                                    }

                                    return newState;
                                });
                            })
                            .catch(err => {
                                clearTimeout(detailTimeout);
                                setLoadingDetail(false);
                                console.warn('[RPO Detail] Background fetch failed:', err.message);
                            });
                    }

                    break; // success — exit retry loop

                } catch (err) {
                    if (attempt === MAX_RETRIES) {
                        console.error('[RPO] All retries failed:', err);
                        setError(err instanceof Error ? err.message : 'Chyba pri získavaní údajov z RPO.');
                    }
                }
            }

            setLoading(false);

        }, 1000); // 1s debounce (increased from 600ms to reduce rate limit hits)

        return () => clearTimeout(handler);
    }, [ico, setFormData]);

    return { loading, error, success, loadingDetail };
};
