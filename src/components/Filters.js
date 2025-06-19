import React, { useState, useRef } from 'react';
import cmData from '../data/cmData';
import './Filters.css';

const getUnique = (arr, key) => [...new Set(arr.map(item => item[key]))];

function MultiSelectDropdown({ label, options, selected, setSelected }) {
  const [open, setOpen] = useState(false);
  const ref = useRef();

  // Close dropdown on outside click
  React.useEffect(() => {
    const handleClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const allSelected = selected.length === options.length;
  const toggleOption = (option) => {
    if (selected.includes(option)) {
      setSelected(selected.filter((item) => item !== option));
    } else {
      setSelected([...selected, option]);
    }
  };

  const clearAll = (e) => {
    e.stopPropagation();
    setSelected([]);
  };

  const handleSelectAll = () => {
    if (allSelected) {
      setSelected([]);
    } else {
      setSelected([...options]);
    }
  };

  return (
    <div className="custom-multiselect" ref={ref}>
      <div className="custom-multiselect-label">{label}</div>
      <div
        className={`custom-multiselect-input${open ? ' open' : ''}`}
        onClick={() => setOpen((o) => !o)}
        tabIndex={0}
      >
        {selected.length === 0 ? (
          <span className="placeholder">Select...</span>
        ) : (
          <div className="selected-tags">
            {selected.slice(0, 2).map((val) => (
              <span className="tag" key={val}>{val}</span>
            ))}
            {selected.length > 2 && <span className="tag">+{selected.length - 2}</span>}
            <span className="clear-btn" onClick={clearAll} title="Clear">×</span>
          </div>
        )}
        <span className="dropdown-arrow">▼</span>
      </div>
      {open && (
        <div className="custom-multiselect-dropdown">
          <label className="dropdown-option select-all-option">
            <input
              type="checkbox"
              checked={allSelected}
              onChange={handleSelectAll}
            />
            <span>Select All</span>
          </label>
          {options.map((option) => (
            <label key={option} className="dropdown-option">
              <input
                type="checkbox"
                checked={selected.includes(option)}
                onChange={() => toggleOption(option)}
              />
              <span>{option}</span>
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

function Filters({ onSearch }) {
  const [selectedCodes, setSelectedCodes] = useState([]);
  const [selectedDescriptions, setSelectedDescriptions] = useState([]);
  const [selectedStatuses, setSelectedStatuses] = useState([]);

  const handleReset = () => {
    setSelectedCodes([]);
    setSelectedDescriptions([]);
    setSelectedStatuses([]);
    if (onSearch) onSearch([], [], []);
  };

  const handleSearch = () => {
    if (onSearch) onSearch(selectedCodes, selectedDescriptions, selectedStatuses);
  };

  return (
    <div className="filters-container professional">
      <MultiSelectDropdown
        label="CM Code"
        options={getUnique(cmData, 'cmCode')}
        selected={selectedCodes}
        setSelected={setSelectedCodes}
      />
      <MultiSelectDropdown
        label="CM Description"
        options={getUnique(cmData, 'cmDescription')}
        selected={selectedDescriptions}
        setSelected={setSelectedDescriptions}
      />
      <MultiSelectDropdown
        label="Signoff Status"
        options={getUnique(cmData, 'signoffStatus')}
        selected={selectedStatuses}
        setSelected={setSelectedStatuses}
      />
      <div className="filter-actions">
        <button className="search-btn" onClick={handleSearch}>Search</button>
        <button className="reset-btn" onClick={handleReset}>Reset</button>
      </div>
    </div>
  );
}

export default Filters; 