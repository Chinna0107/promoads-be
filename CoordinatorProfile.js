import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import config from '../../config';

const CoordinatorProfile = () => {
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = async () => {
    try {
      const token = localStorage.getItem('token');
      const user = localStorage.getItem('user');

      if (!token || !user) {
        navigate('/login');
        return;
      }

      const response = await fetch(`${config.BASE_URL}/api/users/profile`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        const data = await response.json();
        setProfile(data);
      } else {
        setProfile(JSON.parse(user));
      }
    } catch (err) {
      console.error('Profile fetch error:', err);
      const user = localStorage.getItem('user');
      if (user) {
        setProfile(JSON.parse(user));
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfile();
  }, []);

  if (loading) {
    return (
      <div style={{ display: 'flex', minHeight: '100vh', background: '#000' }}>
        <div style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ width: '60px', height: '60px', border: '6px solid rgba(255, 255, 0, 0.3)', borderTop: '6px solid #ffff00', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto 20px' }}></div>
            <p style={{ color: '#ffff00', fontSize: '1.1rem', fontWeight: 'bold' }}>Loading profile...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div style={{ display: 'flex', minHeight: '100vh', background: '#000' }}>
        <div style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
          <div style={{ color: '#ffff00', textAlign: 'center' }}>Failed to load profile</div>
        </div>
      </div>
    );
  }

  const qrData = JSON.stringify({
    id: profile.id || profile._id,
    name: profile.name,
    email: profile.email,
    mobile: profile.mobile,
    rollNo: profile.rollNo,
    role: 'coordinator',
    timestamp: Date.now()
  });

  const getInitial = (name) => {
    return name ? name.charAt(0).toUpperCase() : 'C';
  };

  return (
    <div style={{ minHeight: '100vh', background: '#000' }}>
      <style>
        {`
          @keyframes spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
          @media (max-width: 768px) {
            .details-qr-grid { grid-template-columns: 1fr !important; gap: 20px !important; }
            .qr-section { order: 2; }
            .details-section { order: 1; }
            .profile-card { padding: 25px !important; }
            .profile-avatar { width: 80px !important; height: 80px !important; font-size: 2rem !important; }
          }
        `}
      </style>
      
      <div style={{ padding: '40px' }}>
        <div className="profile-card" style={{
          background: 'rgba(255, 255, 255, 0.1)',
          backdropFilter: 'blur(10px)',
          padding: '40px',
          borderRadius: '20px',
          boxShadow: '0 8px 32px rgba(255, 255, 0, 0.1)',
          border: '1px solid rgba(255, 255, 0, 0.2)',
          color: '#ffff00'
        }}>
          {/* Profile Section */}
          <div style={{ marginBottom: '30px' }}>
            {/* Details and QR Grid */}
            <div className="details-qr-grid" style={{ 
              display: 'grid', 
              gridTemplateColumns: '1fr 1fr', 
              gap: '30px', 
              alignItems: 'start' 
            }}>
              {/* Left Side - Profile Details */}
              <div className="details-section" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                {/* Avatar and Name */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '20px', marginBottom: '20px' }}>
                  <div className="profile-avatar" style={{
                    width: '100px',
                    height: '100px',
                    borderRadius: '50%',
                    background: '#ffff00',
                    color: '#000',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '3rem',
                    fontWeight: 'bold',
                    boxShadow: '0 4px 15px rgba(255, 255, 0, 0.3)'
                  }}>
                    {getInitial(profile.name)}
                  </div>
                  <div>
                    <h2 style={{ fontSize: '2.2rem', margin: '0', color: '#ffff00', fontWeight: 'bold' }}>
                      {profile.name}
                    </h2>
                    <p style={{ fontSize: '1.1rem', color: '#ffff00', margin: '5px 0 0 0', opacity: 0.8 }}>
                      Coordinator
                    </p>
                  </div>
                </div>
                
                {/* Details */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                  <div>
                    <p style={{ fontSize: '1.1rem', color: '#ffff00', fontWeight: '600', margin: '0' }}>
                      {profile.eventName || 'TRI-COD 2K26'}
                    </p>
                  </div>
                  
                  <div>
                    <p style={{ fontSize: '1.1rem', color: '#ffff00', fontWeight: '600', margin: '0', wordBreak: 'break-word' }}>
                      {profile.email}
                    </p>
                  </div>
                  
                  {profile.college && (
                    <div>
                      <p style={{ fontSize: '1.1rem', color: '#ffff00', fontWeight: '600', margin: '0' }}>
                        {profile.college}
                      </p>
                    </div>
                  )}
                  
                  {profile.branch && (
                    <div>
                      <p style={{ fontSize: '1.1rem', color: '#ffff00', fontWeight: '600', margin: '0' }}>
                        {profile.branch}
                      </p>
                    </div>
                  )}
                  
                  {profile.year && (
                    <div>
                      <p style={{ fontSize: '1.1rem', color: '#ffff00', fontWeight: '600', margin: '0' }}>
                        {profile.year}
                      </p>
                    </div>
                  )}
                  
                  {profile.mobile && (
                    <div>
                      <p style={{ fontSize: '1.1rem', color: '#ffff00', fontWeight: '600', margin: '0' }}>
                        {profile.mobile}
                      </p>
                    </div>
                  )}
                </div>
              </div>
              
              {/* Right Side - QR Code */}
              <div className="qr-section" style={{ 
                display: 'flex', 
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '20px'
              }}>
                <h3 style={{ color: '#ffff00', marginBottom: '25px', fontSize: '1.3rem', fontWeight: 'bold' }}>
                  QR Code
                </h3>
                <div style={{ 
                  background: '#fff', 
                  padding: '25px', 
                  borderRadius: '20px', 
                  boxShadow: '0 8px 25px rgba(255, 255, 0, 0.2)'
                }}>
                  <QRCodeSVG 
                    value={qrData}
                    size={160}
                    level="H"
                    includeMargin={false}
                  />
                </div>
                <p style={{ 
                  marginTop: '15px', 
                  fontSize: '0.85rem', 
                  color: '#ffff00', 
                  textAlign: 'center',
                  opacity: 0.8,
                  fontWeight: '500'
                }}>
                  ✨ Coordinator Access
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CoordinatorProfile;