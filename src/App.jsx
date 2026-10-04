import { useEffect, useState } from 'react';

const OBJECTS = ['Account', 'Opportunity', 'Lead', 'Contact', 'Case'];

function App() {
  const [loggedIn, setLoggedIn] = useState(false);
  const [selectedObject, setSelectedObject] = useState('Account');
  const [fields, setFields] = useState([]);
  const [records, setRecords] = useState([]);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [recordIdToEdit, setRecordIdToEdit] = useState(null);
  const [formData, setFormData] = useState({});

  const fetchStatus = async () => {
    const response = await fetch('/api/auth/status');
    const data = await response.json();
    setLoggedIn(Boolean(data.loggedIn));
  };

  useEffect(() => {
    fetchStatus();

    const params = new URLSearchParams(window.location.search);
    if (params.get('oauth') === 'success') {
      setMessage('Salesforce login successful.');
      window.history.replaceState({}, document.title, '/');
    }
  }, []);

  const loadObjectData = async (objectName, nextOffset = 0, append = false) => {
    if (!loggedIn) return;

    setLoading(true);

    try {
      const metaResponse = await fetch(`/api/metadata/${objectName}`);
      const metaData = await metaResponse.json();

      if (!metaResponse.ok || !metaData.success) {
        throw new Error(metaData.message || 'Unable to load object metadata.');
      }

      const nextFields = metaData.fields.slice(0, 10).map((field) => field.name);
      setFields(nextFields);
      setFormData(Object.fromEntries(nextFields.map((field) => [field, ''])));

      const queryFields = nextFields.join(',');
      const recordResponse = await fetch(
        `/api/records/${objectName}?offset=${nextOffset}&limit=20&fields=${encodeURIComponent(queryFields)}`
      );
      const recordData = await recordResponse.json();

      if (!recordResponse.ok || !recordData.success) {
        throw new Error(recordData.message || 'Unable to fetch records.');
      }

      const nextRecords = append ? [...records, ...recordData.records] : recordData.records;
      setRecords(nextRecords);
      setOffset(nextOffset + recordData.records.length);
      setHasMore(recordData.totalSize > nextOffset + recordData.records.length);
    } catch (error) {
      setMessage(error.message || 'Something went wrong while loading the object.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!loggedIn) return;
    loadObjectData(selectedObject, 0, false);
  }, [selectedObject, loggedIn]);

  useEffect(() => {
    const onScroll = () => {
      const nearBottom =
        window.innerHeight + window.scrollY >= document.body.offsetHeight - 150;

      if (nearBottom && loggedIn && !loading && hasMore) {
        loadObjectData(selectedObject, offset, true);
      }
    };

    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, [loggedIn, loading, hasMore, offset, selectedObject]);

  const handleLogin = async () => {
    try {
      const response = await fetch('/api/auth/login');
      const data = await response.json();

      if (!response.ok || !data.success) {
        setMessage(data.error || 'Unable to start Salesforce login.');
        return;
      }

      window.location.href = data.url;
    } catch (error) {
      setMessage('Login failed. Please verify your Salesforce setup.');
    }
  };

  const handleInputChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const resetForm = () => {
    setFormData(Object.fromEntries(fields.map((field) => [field, ''])));
    setRecordIdToEdit(null);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    const payload = {};
    fields.forEach((field) => {
      if (formData[field] !== '') {
        payload[field] = formData[field];
      }
    });

    const method = recordIdToEdit ? 'PATCH' : 'POST';
    const url = recordIdToEdit
      ? `/api/records/${selectedObject}/${recordIdToEdit}`
      : `/api/records/${selectedObject}`;

    try {
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || 'Operation failed.');
      }

      setMessage(recordIdToEdit ? 'Record updated successfully.' : 'Record created successfully.');
      resetForm();
      loadObjectData(selectedObject, 0, false);
    } catch (error) {
      setMessage(error.message || 'Unable to save the record.');
    }
  };

  const handleEdit = (record) => {
    const nextFormData = {};
    fields.forEach((field) => {
      nextFormData[field] = record[field] ?? '';
    });
    setFormData(nextFormData);
    setRecordIdToEdit(record.Id);
    setMessage('Editing selected record.');
  };

  const handleDelete = async (recordId) => {
    try {
      const response = await fetch(`/api/records/${selectedObject}/${recordId}`, {
        method: 'DELETE',
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || 'Delete failed.');
      }

      setMessage('Record deleted successfully.');
      loadObjectData(selectedObject, 0, false);
    } catch (error) {
      setMessage(error.message || 'Unable to delete this record.');
    }
  };

  const renderTable = () => {
    if (records.length === 0) {
      return <p className="empty-state">No records available for this object.</p>;
    }

    return (
      <div className="table-wrapper">
        <table>
          <thead>
            <tr>
              {fields.map((field) => (
                <th key={field}>{field}</th>
              ))}
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {records.map((record) => (
              <tr key={record.Id}>
                {fields.map((field) => (
                  <td key={`${record.Id}-${field}`}>{String(record[field] ?? '')}</td>
                ))}
                <td className="action-cell">
                  <button className="secondary" onClick={() => handleEdit(record)}>
                    Edit
                  </button>
                  <button className="danger" onClick={() => handleDelete(record.Id)}>
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <div className="app-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">Assignment #1</p>
          <h1>Salesforce CRUD Dashboard</h1>
        </div>
        {!loggedIn ? (
          <button className="primary" onClick={handleLogin}>
            Login with Salesforce
          </button>
        ) : (
          <span className="status-pill">Connected</span>
        )}
      </header>

      {message ? <div className="message-box">{message}</div> : null}

      {!loggedIn ? (
        <section className="login-card">
          <h2>Connect to Salesforce</h2>
          <p>
            Log in using an OAuth 2.0-connected app and then select one of the standard Salesforce
            objects.
          </p>
        </section>
      ) : (
        <>
          <section className="controls">
            <label htmlFor="object-selector">Choose object</label>
            <select
              id="object-selector"
              value={selectedObject}
              onChange={(event) => setSelectedObject(event.target.value)}
            >
              {OBJECTS.map((objectName) => (
                <option key={objectName} value={objectName}>
                  {objectName}
                </option>
              ))}
            </select>
          </section>

          <section className="form-panel">
            <h2>{recordIdToEdit ? 'Update record' : 'Create new record'}</h2>
            <form onSubmit={handleSubmit} className="record-form">
              {fields.map((field) => (
                <div className="field-group" key={field}>
                  <label htmlFor={field}>{field}</label>
                  <input
                    id={field}
                    type="text"
                    value={formData[field] || ''}
                    onChange={(event) => handleInputChange(field, event.target.value)}
                    placeholder={field}
                  />
                </div>
              ))}

              <div className="form-actions">
                <button type="submit" className="primary">
                  {recordIdToEdit ? 'Save changes' : 'Create record'}
                </button>
                <button type="button" className="secondary" onClick={resetForm}>
                  Reset
                </button>
              </div>
            </form>
          </section>

          <section className="records-panel">
            <h2>{selectedObject} records</h2>
            {loading && records.length === 0 ? <p>Loading records...</p> : renderTable()}
          </section>
        </>
      )}
    </div>
  );
}

export default App;
