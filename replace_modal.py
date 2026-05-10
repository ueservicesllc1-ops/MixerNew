import sys

with open('src/pages/DesktopMultitrack.jsx', 'r', encoding='utf-8') as f:
    lines = f.readlines()

start_idx = -1
end_idx = -1

for i, line in enumerate(lines):
    if "{(!currentUser || showLoginModal) && (" in line:
        start_idx = i
        break

if start_idx != -1:
    # Find the closing tag of the modal
    open_brackets = 0
    for i in range(start_idx, len(lines)):
        open_brackets += lines[i].count('{') - lines[i].count('}')
        if open_brackets < 0 and lines[i].strip() == ")}":
            end_idx = i
            break

if start_idx != -1 and end_idx != -1:
    replacement = """            {(showLoginModal) && (
                <div style={{ position: 'fixed', inset: 0, zIndex: 100000, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(5px)' }}>
                    <div style={{ background: '#1c1c1e', padding: '30px', borderRadius: '12px', width: '320px', border: '1px solid #333', position: 'relative', boxShadow: '0 20px 50px rgba(0,0,0,0.5)' }}>
                        <button onClick={() => setShowLoginModal(false)} style={{ position: 'absolute', top: '15px', right: '15px', background: 'none', border: 'none', color: '#888', cursor: 'pointer', fontSize: '1.2rem' }}><X size={20} /></button>
                        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '24px' }}>
                            <img src="/logo2blanco.png" alt="Zion Stage" style={{ height: '36px' }} />
                        </div>
                        <h2 style={{ color: 'white', marginTop: 0, marginBottom: '10px', textAlign: 'center', fontWeight: '800' }}>Activar Zion Stage</h2>
                        <p style={{color: '#aaa', fontSize: '0.85rem', textAlign: 'center', marginBottom: '15px'}}>Ingresa tu serial para desbloquear la versión completa.</p>
                        <input type="text" placeholder="ZION-XXXX-XXXX" value={loginEmail} onChange={e => setLoginEmail(e.target.value)} style={{ padding: '12px', borderRadius: '8px', border: '1px solid #444', background: '#2a2a2c', color: 'white', fontSize: '1rem', outline: 'none', textAlign: 'center', width: '100%', boxSizing: 'border-box' }} />
                        {loginError && <div style={{ color: '#ff5252', fontSize: '0.85rem', textAlign: 'center', padding: '8px', borderRadius: '6px', background: 'rgba(255,82,82,0.1)', marginTop: '10px' }}>{loginError}</div>}
                        {loginSuccess && <div style={{ color: '#4ade80', fontSize: '0.82rem', textAlign: 'center', padding: '10px', borderRadius: '6px', background: 'rgba(74,222,128,0.1)', marginTop: '10px' }}>{loginSuccess}</div>}
                        <button onClick={async () => {
                            setLoginError('');
                            if(loginEmail.length >= 8) {
                                if (window.zionNative && window.zionNative.saveLicense) {
                                    await window.zionNative.saveLicense(loginEmail, 'pro');
                                    setIsDemo(false);
                                }
                                setLoginSuccess('Activación exitosa.');
                                setTimeout(() => setShowLoginModal(false), 2000);
                            } else {
                                setLoginError('Serial inválido.');
                            }
                        }} style={{ width: '100%', padding: '12px', background: '#00d2d3', border: 'none', borderRadius: '8px', color: 'white', fontWeight: 'bold', fontSize: '1rem', cursor: 'pointer', marginTop: '15px' }}>Activar Ahora</button>
                        <button onClick={() => setShowLoginModal(false)} style={{ width: '100%', padding: '12px', background: 'transparent', border: '1px solid #444', borderRadius: '8px', color: '#aaa', fontWeight: 'bold', fontSize: '1rem', cursor: 'pointer', marginTop: '10px' }}>Continuar en modo Demo</button>
                    </div>
                </div>
            )}
"""
    lines = lines[:start_idx] + [replacement] + lines[end_idx+1:]
    
    with open('src/pages/DesktopMultitrack.jsx', 'w', encoding='utf-8') as f:
        f.writelines(lines)
    print("Successfully replaced modal")
else:
    print("Could not find modal block")
