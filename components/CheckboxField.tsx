
import React from 'react';

interface CheckboxFieldProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  gridSpan?: string;
}

const CheckboxField: React.FC<CheckboxFieldProps> = ({ label, id, gridSpan = 'md:col-span-3', ...props }) => (
  <div className={`w-full ${gridSpan} flex items-center mt-2`}>
    <input
      id={id}
      type="checkbox"
      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded dark:bg-slate-700 dark:border-gray-600 dark:focus:ring-blue-600 dark:ring-offset-gray-800 cursor-pointer"
      {...props}
    />
    <label htmlFor={id} className="ml-3 block text-sm font-medium text-gray-700 dark:text-gray-300 transition-colors duration-300 cursor-pointer">
      {label}
    </label>
  </div>
);

export default CheckboxField;
