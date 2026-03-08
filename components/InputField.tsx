import React from 'react';

interface InputFieldProps extends React.InputHTMLAttributes<HTMLInputElement | HTMLTextAreaElement> {
  label: string;
  gridSpan?: string;
  suggestions?: string[];
  error?: string | boolean;
}

const InputField: React.FC<InputFieldProps> = ({ label, id, gridSpan = 'md:col-span-1', suggestions, error, ...props }) => {
  const isTextArea = props.type === 'textarea';
  const isDate = props.type === 'date';
  const isRodneCislo = props.name === 'rodneCislo';
  const listId = `${id}-list`;
  
  // State for suggestions dropdown
  const [showSuggestions, setShowSuggestions] = React.useState(false);
  const wrapperRef = React.useRef<HTMLDivElement>(null);

  // Close suggestions when clicking outside
  React.useEffect(() => {
      const handleClickOutside = (event: MouseEvent) => {
          if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
              setShowSuggestions(false);
          }
      };
      document.addEventListener("mousedown", handleClickOutside);
      return () => {
          document.removeEventListener("mousedown", handleClickOutside);
      };
  }, []);

  const handleSuggestionClick = (value: string) => {
      if (props.onChange) {
          const syntheticEvent = {
              target: {
                  name: props.name,
                  value: value,
                  type: props.type
              }
          } as React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>;
          props.onChange(syntheticEvent);
      }
      setShowSuggestions(false);
  };
  
  // State for date input display value (DD.MM.YYYY)
  const [displayValue, setDisplayValue] = React.useState('');
  
  // Sync display value with prop value (YYYY-MM-DD -> DD.MM.YYYY)
  React.useEffect(() => {
    if (isDate && props.value) {
      const [y, m, d] = String(props.value).split('-');
      if (y && m && d) {
        setDisplayValue(`${d}.${m}.${y}`);
      } else {
        setDisplayValue('');
      }
    }
  }, [props.value, isDate]);

  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let val = e.target.value;
    
    const isDeleting = val.length < displayValue.length;
    val = val.replace(/[^0-9.]/g, '');
    
    if (!isDeleting) {
        if (val.length === 2 && !val.includes('.')) val += '.';
        if (val.length === 5 && val.split('.').length === 2) val += '.';
    }
    
    if (val.length > 10) val = val.substring(0, 10);
    setDisplayValue(val);
    
    if (val.length === 10) {
      const [d, m, y] = val.split('.');
      if (d && m && y && !isNaN(Number(d)) && !isNaN(Number(m)) && !isNaN(Number(y))) {
         const day = parseInt(d, 10);
         const month = parseInt(m, 10);
         const year = parseInt(y, 10);
         
         if (day > 0 && day <= 31 && month > 0 && month <= 12 && year > 1900) {
             const dateObj = new Date(year, month - 1, day);
             if (dateObj.getFullYear() === year && dateObj.getMonth() === month - 1 && dateObj.getDate() === day) {
                 const isoDate = `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
                 const syntheticEvent = {
                   ...e,
                   target: { ...e.target, name: props.name, value: isoDate, type: 'date' }
                 } as React.ChangeEvent<HTMLInputElement>;
                 if (props.onChange) props.onChange(syntheticEvent);
             }
         }
      }
    } else if (val === '') {
        const syntheticEvent = {
          ...e,
          target: { ...e.target, name: props.name, value: '', type: 'date' }
        } as React.ChangeEvent<HTMLInputElement>;
        if (props.onChange) props.onChange(syntheticEvent);
    }
  };

  // Handler for the native date input (calendar picker selection)
  const handleNativeDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value; // YYYY-MM-DD
    if (val) {
      const [y, m, d] = val.split('-');
      if (y && m && d) setDisplayValue(`${d}.${m}.${y}`);
    } else {
      setDisplayValue('');
    }
    const syntheticEvent = {
      ...e,
      target: { ...e.target, name: props.name, value: val, type: 'date' }
    } as React.ChangeEvent<HTMLInputElement>;
    if (props.onChange) props.onChange(syntheticEvent);
  };

  const handleRodneCisloChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      let val = e.target.value;
      const isDeleting = props.value && val.length < String(props.value).length;
      val = val.replace(/[^0-9/]/g, '');
      if (!isDeleting) {
          if (val.length === 6 && !val.includes('/')) val += '/';
      }
      if (val.length > 11) val = val.substring(0, 11);
      const syntheticEvent = {
          ...e,
          target: { ...e.target, name: props.name, value: val, type: 'text' }
      } as React.ChangeEvent<HTMLInputElement>;
      if (props.onChange) props.onChange(syntheticEvent);
  };

  const baseClassName = `mt-1 block w-full px-3 py-2 bg-white dark:bg-slate-700 border ${
    error
      ? 'border-red-500 focus:ring-red-500 focus:border-red-500'
      : 'border-gray-300 dark:border-gray-600 focus:ring-blue-500 focus:border-blue-500'
  } rounded-md shadow-sm placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none sm:text-sm text-gray-900 dark:text-gray-100 transition-colors duration-300`;

  const commonProps: React.InputHTMLAttributes<HTMLInputElement | HTMLTextAreaElement> = {
    id: id,
    list: suggestions ? listId : undefined,
    className: baseClassName,
    ...props
  };

  if (isRodneCislo) {
      commonProps.onChange = handleRodneCisloChange;
      commonProps.maxLength = 11;
      commonProps.inputMode = 'numeric';
      commonProps.placeholder = 'RRMMDD/CCCC';
  }

  return (
    <div className={`w-full ${gridSpan}`} ref={wrapperRef}>
      <label htmlFor={id} className={`block text-sm font-medium ${error ? 'text-red-600 dark:text-red-400' : 'text-gray-700 dark:text-gray-300'} transition-colors duration-300`}>
        {label}
      </label>
      {isTextArea ? (
        <div className="relative">
            <textarea {...commonProps} rows={4}></textarea>
            {suggestions && suggestions.length > 0 && (
                <>
                    <button 
                        type="button"
                        className="absolute top-2 right-2 p-1.5 text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 bg-gray-100 dark:bg-slate-600 rounded-md shadow-sm border border-gray-200 dark:border-gray-500 transition-colors"
                        onClick={() => setShowSuggestions(!showSuggestions)}
                        title="Vybrať zo zoznamu činností"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                    </button>
                    {showSuggestions && (
                        <ul className="absolute z-20 w-full mt-1 bg-white dark:bg-slate-700 border border-gray-300 dark:border-gray-600 rounded-md shadow-lg max-h-60 overflow-auto">
                            {suggestions.map((s, idx) => (
                                <li 
                                    key={idx} 
                                    className="px-3 py-2 hover:bg-blue-50 dark:hover:bg-slate-600 cursor-pointer text-sm text-gray-700 dark:text-gray-200 border-b border-gray-100 dark:border-gray-600 last:border-0"
                                    onClick={() => handleSuggestionClick(s)}
                                >
                                    {s}
                                </li>
                            ))}
                        </ul>
                    )}
                </>
            )}
        </div>
      ) : isDate ? (
        /*
         * Cross-origin iframe fix:
         * showPicker() je blokované bezpečnostnou politikou prehliadača v iframe.
         * Riešenie: natívny <input type="date"> musí mať REÁLNE rozmery a byť
         * priamo klikateľný používateľom — len vtedy prehliadač otvorí picker.
         * Prekrýva iba pravú časť (ikonku), text input ostáva funkčný.
         */
        <div className="relative mt-1">
            {/* Visible formatted text input */}
            <input 
                {...commonProps}
                type="text"
                inputMode="numeric"
                placeholder="DD.MM.RRRR"
                value={displayValue}
                onChange={handleDateChange}
                maxLength={10}
                className={`${baseClassName} pr-10`}
            />
            {/* Static calendar icon (pointer-events-none, dekoratívna) */}
            <div className="absolute inset-y-0 right-0 flex items-center pr-2 pointer-events-none z-0">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
            </div>
            {/*
              * Native date input — opacity-0 ale s reálnymi rozmermi (w-10, full height).
              * Prekrýva len oblasť ikonky. Priame kliknutie od používateľa → picker sa otvorí.
              * Na rozdiel od showPicker(), toto funguje aj v cross-origin iframe.
              * Trik: webkit-calendar-picker-indicator roztiahneme na celú plochu.
              */}
            <input
                type="date"
                aria-hidden="true"
                tabIndex={-1}
                value={props.value as string || ''}
                min={props.min}
                max={props.max}
                onChange={handleNativeDateChange}
                className="absolute inset-y-0 right-0 w-10 h-full opacity-0 cursor-pointer z-10 [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:inset-0 [&::-webkit-calendar-picker-indicator]:w-full [&::-webkit-calendar-picker-indicator]:h-full [&::-webkit-calendar-picker-indicator]:cursor-pointer"
            />
        </div>
      ) : (
        <input {...commonProps} />
      )}
      {suggestions && (
        <datalist id={listId}>
          {suggestions.map(s => <option key={s} value={s} />)}
        </datalist>
      )}
    </div>
  );
};

export default InputField;