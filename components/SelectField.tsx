
import React from 'react';

interface SelectFieldProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label: string;
  options: string[];
  values?: string[];
  gridSpan?: string;
}

const SelectField: React.FC<SelectFieldProps> = ({ label, id, options, values, gridSpan = 'md:col-span-1', ...props }) => {
  return (
    <div className={`w-full ${gridSpan}`}>
      <label htmlFor={id} className="block text-sm font-medium text-gray-700 dark:text-gray-300 transition-colors duration-300">
        {label}
      </label>
      <select
        id={id}
        className="mt-1 block w-full pl-3 pr-10 py-2 bg-white dark:bg-slate-700 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm text-gray-900 dark:text-gray-100 transition-colors duration-300"
        {...props}
      >
        <option value="">Vyberte možnosť...</option>
        {options.map((option, index) => (
          <option key={option} value={values ? values[index] : option}>{option}</option>
        ))}
      </select>
    </div>
  );
};

export default SelectField;
