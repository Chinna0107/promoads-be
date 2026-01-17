import React, { useEffect, useState } from 'react';
import UserMenu from '../user/UserMenu';
import config from '../../config';

const TakeTest = () => {
  const [tests, setTests] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchTests = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${config.BASE_URL}/api/tests`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (response.ok) {
        const data = await response.json();
        setTests(data);
      }
    } catch (error) {
      console.error('Error fetching tests:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTests();
  }, []);

  const handleStartTest = (testId) => {
    // Navigate to test or handle test start
    console.log('Starting test:', testId);
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', minHeight: '100vh' }}>
        <UserMenu />
        <div style={{ marginLeft: '280px', flex: 1, background: '#000', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ width: '60px', height: '60px', border: '6px solid rgba(255, 255, 0, 0.3)', borderTop: '6px solid #ffff00', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto 20px' }}></div>
            <p style={{ color: '#ffff00', fontSize: '1.1rem', fontWeight: 'bold' }}>Loading tests...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <UserMenu />
      <div style={{ marginLeft: '280px', flex: 1, background: '#000', color: '#ffff00', padding: '40px' }}>
        <style>
          {`
            @keyframes spin {
              from { transform: rotate(0deg); }
              to { transform: rotate(360deg); }
            }
            @media (max-width: 768px) {
              .test-content { margin-left: 0 !important; padding-top: 80px !important; }
            }
          `}
        </style>
        
        <div className="test-content">
          <div style={{
            background: 'rgba(255, 255, 255, 0.1)',
            backdropFilter: 'blur(10px)',
            padding: '40px',
            borderRadius: '20px',
            boxShadow: '0 8px 32px rgba(255, 255, 0, 0.1)',
            border: '1px solid rgba(255, 255, 0, 0.2)'
          }}>
            <h1 style={{ fontSize: '2.5rem', margin: '0 0 30px 0', color: '#ffff00', fontWeight: 'bold' }}>
              Available Tests
            </h1>
            
            {tests.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px' }}>
                <p style={{ fontSize: '1.2rem', color: '#ffff00', opacity: 0.8, margin: '0 0 20px 0' }}>
                  No tests available at the moment.
                </p>
                <p style={{ fontSize: '1rem', color: '#ffff00', opacity: 0.6 }}>
                  Check back later for upcoming coding challenges.
                </p>
              </div>
            ) : (
              <div style={{ display: 'grid', gap: '20px' }}>
                {tests.map((test, index) => (
                  <div key={index} style={{
                    background: 'rgba(255, 255, 255, 0.05)',
                    padding: '25px',
                    borderRadius: '15px',
                    border: '1px solid rgba(255, 255, 0, 0.1)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}>
                    <div>
                      <h3 style={{ color: '#ffff00', margin: '0 0 10px 0', fontSize: '1.3rem' }}>
                        {test.name || 'Coding Challenge'}
                      </h3>
                      <p style={{ color: '#ffff00', opacity: 0.8, margin: '0' }}>
                        Duration: {test.duration || '60 minutes'}
                      </p>
                    </div>
                    <button
                      onClick={() => handleStartTest(test.id)}
                      style={{
                        background: '#ffff00',
                        color: '#000',
                        border: 'none',
                        padding: '12px 24px',
                        borderRadius: '8px',
                        fontSize: '1rem',
                        fontWeight: 'bold',
                        cursor: 'pointer',
                        transition: 'all 0.3s ease'
                      }}
                      onMouseOver={(e) => e.target.style.background = '#e6e600'}
                      onMouseOut={(e) => e.target.style.background = '#ffff00'}
                    >
                      Start Test
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default TakeTest;