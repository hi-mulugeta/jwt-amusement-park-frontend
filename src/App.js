import React, { useState, useEffect, createContext, useContext } from "react";
import axios from "axios";
import "./App.css";

// Create Park Context - Keeps track of your wristband
const ParkContext = createContext();

function App() {
  const [user, setUser] = useState(null);
  const [rides, setRides] = useState({});
  const [loading, setLoading] = useState(false);

  // Check if we already have a wristband when app loads
  useEffect(() => {
    const storedUser = localStorage.getItem("parkUser");
    const storedToken = localStorage.getItem("parkToken");

    if (storedUser && storedToken) {
      setUser(JSON.parse(storedUser));
      axios.defaults.headers.common["Authorization"] = `Bearer ${storedToken}`;
    }
  }, []);

  // Login - Get your wristband
  const login = async (email, password) => {
    setLoading(true);
    try {
      const response = await axios.post("http://localhost:5050/api/login", {
        email,
        password,
      });

      // Save wristband and user info
      localStorage.setItem("parkToken", response.data.wristband);
      localStorage.setItem("parkUser", JSON.stringify(response.data.user));

      // Set authorization header for future requests
      axios.defaults.headers.common["Authorization"] =
        `Bearer ${response.data.wristband}`;

      setUser(response.data.user);
      return { success: true };
    } catch (error) {
      return {
        success: false,
        message: error.response?.data?.message || "Login failed",
      };
    } finally {
      setLoading(false);
    }
  };

  // Logout - Remove wristband
  const logout = () => {
    localStorage.removeItem("parkToken");
    localStorage.removeItem("parkUser");
    delete axios.defaults.headers.common["Authorization"];
    setUser(null);
    setRides({});
  };

  // Fetch rides from different sections
  const fetchRides = async (rideType) => {
    setLoading(true);
    try {
      const response = await axios.get(`http://localhost:5050/api/${rideType}`);
      setRides((prev) => ({ ...prev, [rideType]: response.data }));
      return { success: true };
    } catch (error) {
      const message = error.response?.data?.message || "Failed to fetch rides";
      alert(message);
      return { success: false, message };
    } finally {
      setLoading(false);
    }
  };

  return (
    <ParkContext.Provider value={{ user, rides, login, logout, fetchRides }}>
      <div className="park-container">
        <Header />
        <div className="park-content">
          {!user ? (
            <LoginSection />
          ) : (
            <>
              <WelcomeSection />
              <RideSections />
            </>
          )}
        </div>
        {loading && <div className="loading">Loading...</div>}
      </div>
    </ParkContext.Provider>
  );
}

// Header Component - Park Entrance
function Header() {
  const { user, logout } = useContext(ParkContext);

  return (
    <header className="park-header">
      <h1>🎢 JWT Amusement Park</h1>
      <div className="header-controls">
        {user ? (
          <>
            <span>
              Welcome, {user.email} ({user.role})
            </span>
            <button onClick={logout} className="btn-logout">
              Exit Park
            </button>
          </>
        ) : (
          <span>Please login to access rides</span>
        )}
      </div>
    </header>
  );
}

// Login Component - Get Your Wristband
function LoginSection() {
  const { login } = useContext(ParkContext);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    const result = await login(email, password);
    if (!result.success) {
      alert(result.message);
    }
  };

  return (
    <div className="login-section">
      <h2>Get Your Park Wristband</h2>
      <form onSubmit={handleSubmit}>
        <div>
          <label>Email:</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="visitor@park.com"
            required
          />
        </div>
        <div>
          <label>Password:</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Try: password123 or vipaccess"
            required
          />
        </div>
        <button type="submit">Get Wristband</button>
      </form>
      <div className="demo-credentials">
        <p>
          <strong>Demo Accounts:</strong>
        </p>
        <p>Visitor: visitor@park.com / password123</p>
        <p>VIP: vip@park.com / vipaccess</p>
      </div>
    </div>
  );
}

// Welcome Component - Park Map
function WelcomeSection() {
  return (
    <div className="welcome-section">
      <h2>🎪 Welcome to the Park!</h2>
      <p>Your JWT wristband gives you access to different areas:</p>
      <div className="wristband-info">
        <div className="wristband visitor">Visitor Wristband</div>
        <div className="wristband vip">VIP Wristband</div>
      </div>
    </div>
  );
}

// Rides Component - Different Park Sections
function RideSections() {
  const { user, fetchRides } = useContext(ParkContext);
  const [activeSection, setActiveSection] = useState("");
  const [error, setError] = useState("");

  const handleFetchRides = async (section) => {
    setError("");
    setActiveSection(section);
    const result = await fetchRides(section);
    if (!result.success) {
      setActiveSection("");
    }
  };

  return (
    <div className="rides-section">
      <div className="ride-buttons">
        <button onClick={() => handleFetchRides("public-rides")}>
          Public Rides (No wristband needed)
        </button>
        <button onClick={() => handleFetchRides("protected-rides")}>
          Protected Rides (Any valid wristband)
        </button>
        {user?.role === "vip" && (
          <button onClick={() => handleFetchRides("vip-rides")}>
            VIP Rides (VIP wristband only)
          </button>
        )}
      </div>

      {error && <div className="error-message">{error}</div>}

      {activeSection && (
        <div className="rides-display">
          <h3>{activeSection.replace("-", " ").toUpperCase()}</h3>
          <RidesList section={activeSection} />
        </div>
      )}
    </div>
  );
}

// Rides List Component - FIXED VERSION
function RidesList({ section }) {
  const { rides } = useContext(ParkContext);

  // Safe access to rides data
  const sectionRides = rides && rides[section] ? rides[section] : [];

  return (
    <ul className="rides-list">
      {sectionRides.length > 0 ? (
        sectionRides.map((ride, index) => (
          <li key={index} className="ride-item">
            🎡 {ride}
          </li>
        ))
      ) : (
        <li className="ride-item">No rides available or loading...</li>
      )}
    </ul>
  );
}

export default App;
