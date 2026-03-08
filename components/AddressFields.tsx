
import React from 'react';
import InputField from './InputField';
import SelectField from './SelectField';
import { Address } from '../types';
import { COUNTRIES } from '../constants';

interface AddressFieldsProps {
  address: Address;
  namePrefix: string;
  onChange: (e: React.ChangeEvent<any>) => void;
  required?: boolean;
  showStat?: boolean;
}

const AddressFields: React.FC<AddressFieldsProps> = ({ address, namePrefix, onChange, required = true, showStat = true }) => (
  <>
    <InputField label="Ulica" id={`${namePrefix}.ulica`} name={`${namePrefix}.ulica`} value={address.ulica} onChange={onChange} required={required} />
    <InputField label="Súpisné číslo" id={`${namePrefix}.supisneCislo`} name={`${namePrefix}.supisneCislo`} value={address.supisneCislo} onChange={onChange} required={required} />
    <InputField label="Orientačné číslo" id={`${namePrefix}.orientacneCislo`} name={`${namePrefix}.orientacneCislo`} value={address.orientacneCislo} onChange={onChange} />
    <InputField label="Obec" id={`${namePrefix}.obec`} name={`${namePrefix}.obec`} value={address.obec} onChange={onChange} required={required} />
    <InputField label="PSČ" id={`${namePrefix}.psc`} name={`${namePrefix}.psc`} value={address.psc} onChange={onChange} required={required} />
    {showStat && <SelectField label="Štát" id={`${namePrefix}.stat`} name={`${namePrefix}.stat`} value={address.stat} onChange={onChange} required={required} options={COUNTRIES} />}
  </>
);

export default AddressFields;
