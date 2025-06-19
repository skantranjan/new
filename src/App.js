import Header from './components/Header';
import Footer from './components/Footer';
import Filters from './components/Filters';
import cmData from './data/cmData';
import './App.css';
import React, { useState } from 'react';
import { BrowserRouter as Router, Route, Routes, useNavigate, useParams } from 'react-router-dom';

const PER_PAGE_OPTIONS = [5, 10, 20, 25, 'All'];
const TABLE_WIDTH = 1200;

function StatusText({ status }) {
  let color = '#30ea03';
  if (status === 'Pending') color = '#ffc107';
  if (status === 'Rejected') color = '#ff3b3b';
  return <span style={{ color, fontWeight: 600 }}>{status}</span>;
}

function AppTable({ filteredData, page, setPage, perPage, setPerPage }) {
  const navigate = useNavigate();
  const ITEMS_PER_PAGE = perPage === 'All' ? filteredData.length : perPage;
  const totalPages = Math.max(1, Math.ceil(filteredData.length / ITEMS_PER_PAGE));
  const paginatedData = filteredData.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);

  const handlePrev = () => setPage((p) => Math.max(1, p - 1));
  const handleNext = () => setPage((p) => Math.min(totalPages, p + 1));
  const handlePerPageChange = (e) => {
    setPerPage(e.target.value === 'All' ? 'All' : Number(e.target.value));
    setPage(1);
  };

  return (
    <div className="results-table-wrapper" style={{ maxWidth: TABLE_WIDTH, width: '100%' }}>
      <table className="results-table">
        <thead>
          <tr>
            <th>CM Code</th>
            <th>CM Description</th>
            <th>Signoff Status</th>
            <th>Add SKU/View</th>
          </tr>
        </thead>
        <tbody>
          {paginatedData.length === 0 ? (
            <tr><td colSpan="4" style={{ textAlign: 'center' }}>No results found.</td></tr>
          ) : (
            paginatedData.map((row, idx) => (
              <tr key={idx}>
                <td>{row.cmCode}</td>
                <td>{row.cmDescription}</td>
                <td><StatusText status={row.signoffStatus} /></td>
                <td>
                  <button className="sku-view-btn" onClick={() => navigate(`/detail/${row.cmCode}`)}>
                    Add SKU/View
                  </button>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
      {/* Pagination Controls */}
      {filteredData.length > 0 && (
        <div className="pagination-controls">
          <select className="per-page-select" value={perPage} onChange={handlePerPageChange}>
            {PER_PAGE_OPTIONS.map(opt => (
              <option key={opt} value={opt}>{opt}</option>
            ))}
          </select>
          <span className="pagination-info">per page</span>
          <button className="pagination-btn" onClick={handlePrev} disabled={page === 1}>Previous</button>
          <span className="pagination-info">Page {page} of {totalPages}</span>
          <button className="pagination-btn" onClick={handleNext} disabled={page === totalPages}>Next</button>
        </div>
      )}
    </div>
  );
}

function DetailPage({ cmCode }) {
  const data = cmData.find(item => item.cmCode === cmCode);
  // Dummy SKUs for this CM Code
  const dummySKUs = [
    { skuCode: 'SKU001', skuName: 'SKU Name 1', skuDescription: 'Description 1', purchasedQuantity: 100, status: 'Active' },
    { skuCode: 'SKU002', skuName: 'SKU Name 2', skuDescription: 'Description 2', purchasedQuantity: 50, status: 'Inactive' },
    { skuCode: 'SKU003', skuName: 'SKU Name 3', skuDescription: 'Description 3', purchasedQuantity: 200, status: 'Active' },
  ];
  const [openIndexes, setOpenIndexes] = React.useState([]);

  const toggleCollapse = idx => {
    setOpenIndexes(openIndexes.includes(idx)
      ? openIndexes.filter(i => i !== idx)
      : [...openIndexes, idx]);
  };

  // Dummy component details for each SKU
  const dummyComponentDetails = [
    {
      materialType: 'Plastic',
      componentReference: 'CR-001',
      componentCode: 'C-1001',
      componentDescription: 'Bottle Cap',
      validFrom: '2023-01-01',
      validTo: '2024-01-01',
      materialGroup: 'MG-01',
      qty: 10,
      uom: 'PCS',
      baseUom: 'PCS',
      packagingType: 'Primary',
      weightType: 'Net',
      unitMeasure: 'g',
      pctPostConsumer: 20,
      pctPostIndustrial: 10,
      pctChemical: 5,
      pctBioSourced: 15,
      structure: 'Single',
      colorOpacity: 'Opaque',
      packagingLevel: 'Level 1',
      dimensions: '5x5x2',
      specEvidence: 'Yes',
      recycledEvidence: 'Yes',
      proofFile: 'proof1.pdf',
      lastUpdated: '2024-06-18',
    },
    {
      materialType: 'Glass',
      componentReference: 'CR-002',
      componentCode: 'C-1002',
      componentDescription: 'Bottle Body',
      validFrom: '2023-02-01',
      validTo: '2024-02-01',
      materialGroup: 'MG-02',
      qty: 1,
      uom: 'PCS',
      baseUom: 'PCS',
      packagingType: 'Primary',
      weightType: 'Gross',
      unitMeasure: 'g',
      pctPostConsumer: 30,
      pctPostIndustrial: 5,
      pctChemical: 0,
      pctBioSourced: 0,
      structure: 'Double',
      colorOpacity: 'Clear',
      packagingLevel: 'Level 2',
      dimensions: '20x5x5',
      specEvidence: 'No',
      recycledEvidence: 'No',
      proofFile: 'proof2.pdf',
      lastUpdated: '2024-06-17',
    },
  ];

  if (!data) return <div style={{ padding: '2rem' }}>No details found for CM Code: {cmCode}</div>;
  return (
    <div className="cm-detail-page">
      <h2 className="cm-detail-title">CM Detail</h2>
      <div className="cm-detail-row">
        <div><b>CM Code:</b> {data.cmCode}</div>
        <div><b>CM Description:</b> {data.cmDescription}</div>
        <div><b>Status:</b> <StatusText status={data.signoffStatus} /></div>
      </div>
      <div className="sku-section">
        <div className="sku-section-header">
          <span className="sku-section-title">SKU Details</span>
          <div className="sku-actions">
            <button className="sku-action-btn">Add</button>
            <button className="sku-action-btn">Edit</button>
            <button className="sku-action-btn">Deactivate</button>
          </div>
        </div>
        <div className="sku-list">
          {dummySKUs.map((sku, idx) => (
            <div className="sku-collapse" key={sku.skuCode}>
              <div className="sku-collapse-header" onClick={() => toggleCollapse(idx)}>
                <span><b>{sku.skuCode}</b> - {sku.skuName} || {sku.skuDescription} || {sku.purchasedQuantity}</span>
                <span className="collapse-toggle">{openIndexes.includes(idx) ? '-' : '+'}</span>
              </div>
              {openIndexes.includes(idx) && (
                <div className="sku-collapse-body">
                  <div><b>SKU Code:</b> {sku.skuCode}</div>
                  <div><b>SKU Name:</b> {sku.skuName}</div>
                  <div><b>SKU Description:</b> {sku.skuDescription}</div>
                  <div><b>Purchased Quantity:</b> {sku.purchasedQuantity}</div>
                  <div><b>Status:</b> <span style={{ color: sku.status === 'Active' ? '#30ea03' : '#ff3b3b', fontWeight: 600 }}>{sku.status}</span></div>
                  <div className="reference-sku" style={{ margin: '1rem 0 0.5rem 0', fontWeight: 600 }}>
                    Reference SKU: {sku.skuCode}
                  </div>
                  <div className="component-detail-table-wrapper">
                    <table className="component-detail-table">
                      <thead>
                        <tr>
                          <th>Material Type</th>
                          <th>Component Reference</th>
                          <th>Component Code</th>
                          <th>Component Description</th>
                          <th>Valid From</th>
                          <th>Valid To</th>
                          <th>Material Group</th>
                          <th>QTY</th>
                          <th>UoM</th>
                          <th>Base UoM</th>
                          <th>Packaging Type</th>
                          <th>Weight Type</th>
                          <th>Unit Measure</th>
                          <th>% Post-Consumer</th>
                          <th>% Post-Industrial</th>
                          <th>% Chemical</th>
                          <th>% Bio-sourced</th>
                          <th>Structure</th>
                          <th>Color/Opacity</th>
                          <th>Packaging Level</th>
                          <th>Dimensions</th>
                          <th>Spec Evidence</th>
                          <th>Recycled Evidence</th>
                          <th>Proof File</th>
                          <th>Last Updated</th>
                          <th>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {dummyComponentDetails.map((comp, cidx) => (
                          <tr key={cidx}>
                            <td>{comp.materialType}</td>
                            <td>{comp.componentReference}</td>
                            <td>{comp.componentCode}</td>
                            <td>{comp.componentDescription}</td>
                            <td>{comp.validFrom}</td>
                            <td>{comp.validTo}</td>
                            <td>{comp.materialGroup}</td>
                            <td>{comp.qty}</td>
                            <td>{comp.uom}</td>
                            <td>{comp.baseUom}</td>
                            <td>{comp.packagingType}</td>
                            <td>{comp.weightType}</td>
                            <td>{comp.unitMeasure}</td>
                            <td>{comp.pctPostConsumer}</td>
                            <td>{comp.pctPostIndustrial}</td>
                            <td>{comp.pctChemical}</td>
                            <td>{comp.pctBioSourced}</td>
                            <td>{comp.structure}</td>
                            <td>{comp.colorOpacity}</td>
                            <td>{comp.packagingLevel}</td>
                            <td>{comp.dimensions}</td>
                            <td>{comp.specEvidence}</td>
                            <td>{comp.recycledEvidence}</td>
                            <td>{comp.proofFile}</td>
                            <td>{comp.lastUpdated}</td>
                            <td>
                              <button className="component-action-btn">Edit</button>
                              <button className="component-action-btn">View</button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function App() {
  const [filteredData, setFilteredData] = useState(cmData);
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(10);

  const handleSearch = (codes, descriptions, statuses) => {
    let result = cmData;
    if (codes.length > 0) {
      result = result.filter(item => codes.includes(item.cmCode));
    }
    if (descriptions.length > 0) {
      result = result.filter(item => descriptions.includes(item.cmDescription));
    }
    if (statuses.length > 0) {
      result = result.filter(item => statuses.includes(item.signoffStatus));
    }
    setFilteredData(result);
    setPage(1); // Reset to first page on new search
  };

  return (
    <Router>
      <div className="App">
        <Header />
        <Routes>
          <Route path="/" element={
            <>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <div style={{ maxWidth: TABLE_WIDTH, width: '100%' }}>
                  <Filters onSearch={handleSearch} />
                </div>
              </div>
              <main style={{ minHeight: '60vh', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <AppTable
                  filteredData={filteredData}
                  page={page}
                  setPage={setPage}
                  perPage={perPage}
                  setPerPage={setPerPage}
                />
              </main>
            </>
          } />
          <Route path="/detail/:cmCode" element={<DetailRouteWrapper />} />
        </Routes>
        <Footer />
      </div>
    </Router>
  );
}

function DetailRouteWrapper() {
  const { cmCode } = useParams();
  return <DetailPage cmCode={cmCode} />;
}

export default App;
