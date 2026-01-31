import React, { useState, useEffect, createContext, useContext } from "react";
import axios from "axios";
import "./App.css";

// Create Park Context - Keeps track of your wristband
const ParkContext = createContext();

// Axios configuration
axios.defaults.baseURL =
  process.env.REACT_APP_API_URL || "http://localhost:5050";
axios.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Auto-logout on 401 Unauthorized
      localStorage.removeItem("parkToken");
      localStorage.removeItem("parkUser");
      window.location.reload();
    }
    return Promise.reject(error);
  },
);

function App() {
  const [user, setUser] = useState(null);
  const [rides, setRides] = useState({});
  const [loading, setLoading] = useState(true);
  const [tokenValid, setTokenValid] = useState(false);

  // Verify token on app load
  useEffect(() => {
    const verifyToken = async () => {
      const storedUser = localStorage.getItem("parkUser");
      const storedToken = localStorage.getItem("parkToken");

      if (!storedUser || !storedToken) {
        setLoading(false);
        return;
      }

      try {
        // Temporarily set token for verification
        const tempAxios = axios.create();
        tempAxios.defaults.headers.common["Authorization"] =
          `Bearer ${storedToken}`;

        const response = await tempAxios.get("/api/verify");

        if (response.data.valid) {
          setUser(JSON.parse(storedUser));
          setTokenValid(true);
          axios.defaults.headers.common["Authorization"] =
            `Bearer ${storedToken}`;
        } else {
          clearAuthData();
        }
      } catch (error) {
        console.log(
          "Token verification failed:",
          error.response?.data?.message || error.message,
        );
        clearAuthData();
      } finally {
        setLoading(false);
      }
    };

    verifyToken();
  }, []);

  // Clear all auth data
  const clearAuthData = () => {
    localStorage.removeItem("parkToken");
    localStorage.removeItem("parkUser");
    delete axios.defaults.headers.common["Authorization"];
    setUser(null);
    setTokenValid(false);
    setRides({});
  };

  // Login function
  const login = async (email, password) => {
    setLoading(true);
    try {
      const response = await axios.post("/api/login", { email, password });

      localStorage.setItem("parkToken", response.data.wristband);
      localStorage.setItem("parkUser", JSON.stringify(response.data.user));

      axios.defaults.headers.common["Authorization"] =
        `Bearer ${response.data.wristband}`;
      setUser(response.data.user);
      setTokenValid(true);

      return { success: true, user: response.data.user };
    } catch (error) {
      return {
        success: false,
        message:
          error.response?.data?.message ||
          "Login failed. Please check your credentials.",
      };
    } finally {
      setLoading(false);
    }
  };

  // Logout function
  const logout = () => {
    clearAuthData();
    alert("You have been logged out successfully!");
  };

  // Fetch rides with token validation
  const fetchRides = async (rideType) => {
    setLoading(true);
    try {
      if (!tokenValid) {
        throw new Error("Session expired. Please login again.");
      }

      const response = await axios.get(`/api/${rideType}`);
      setRides((prev) => ({ ...prev, [rideType]: response.data }));
      return { success: true };
    } catch (error) {
      const message = error.response?.data?.message || error.message;

      if (error.response?.status === 401) {
        clearAuthData();
        return {
          success: false,
          message: "Session expired. Please login again.",
          expired: true,
        };
      }

      return { success: false, message };
    } finally {
      setLoading(false);
    }
  };

  // Loading screen
  if (loading && !user) {
    return (
      <div className="loading-fullscreen">
        <div className="spinner"></div>
        <p>Checking your park wristband...</p>
      </div>
    );
  }

  return (
    <ParkContext.Provider
      value={{ user, rides, login, logout, fetchRides, tokenValid }}
    >
      <div className="park-container">
        <Header />
        <main className="park-content">
          {!user ? <LoginSection /> : <ParkDashboard />}
        </main>
        {loading && <div className="loading-overlay">Loading...</div>}
      </div>
    </ParkContext.Provider>
  );
}

// Header Component
function Header() {
  const { user, logout } = useContext(ParkContext);
  const [timeLeft, setTimeLeft] = useState(null);

  useEffect(() => {
    if (user) {
      const token = localStorage.getItem("parkToken");
      if (token) {
        try {
          // Decode JWT to get expiration time (without verification)
          const payload = JSON.parse(atob(token.split(".")[1]));
          const expTime = payload.exp * 1000;
          const updateTimer = () => {
            const now = Date.now();
            const remaining = Math.max(0, expTime - now);
            const minutes = Math.floor(remaining / 60000);
            const seconds = Math.floor((remaining % 60000) / 1000);
            setTimeLeft(`${minutes}:${seconds.toString().padStart(2, "0")}`);
          };

          updateTimer();
          const timer = setInterval(updateTimer, 1000);
          return () => clearInterval(timer);
        } catch (e) {
          console.error("Error decoding token:", e);
        }
      }
    }
  }, [user]);

  return (
    <header className="park-header">
      <div className="header-title">
        <h1>🎢 JWT Amusement Park</h1>
        <p className="tagline">Where Authentication Meets Fun!</p>
      </div>
      <div className="header-controls">
        {user ? (
          <div className="user-section">
            <div className="user-greeting">
              <span className="welcome">Welcome, {user.email}!</span>
              <span className="role-badge" data-role={user.role}>
                {user.role.toUpperCase()}
              </span>
            </div>
            {timeLeft && (
              <div className="token-timer">
                <span className="timer-icon">⏳</span>
                Wristband expires in: {timeLeft}
              </div>
            )}
            <button onClick={logout} className="btn-logout">
              🚪 Exit Park
            </button>
          </div>
        ) : (
          <div className="guest-message">
            <span>🎫 Get your wristband to access amazing rides!</span>
          </div>
        )}
      </div>
    </header>
  );
}

// Login Component
function LoginSection() {
  const { login } = useContext(ParkContext);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setIsSubmitting(true);

    const result = await login(email, password);

    if (!result.success) {
      setError(result.message);
    }

    setIsSubmitting(false);
  };

  const handleDemoLogin = async (demoEmail, demoPassword) => {
    setEmail(demoEmail);
    setPassword(demoPassword);
    const result = await login(demoEmail, demoPassword);
    if (!result.success) {
      setError(result.message);
    }
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <div className="login-header">
          <h2>🎪 Park Entrance</h2>
          <p>Get your wristband to enter the amusement park!</p>
        </div>

        {error && <div className="error-alert">{error}</div>}

        <form onSubmit={handleSubmit} className="login-form">
          <div className="form-group">
            <label htmlFor="email">📧 Email Address</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="visitor@park.com"
              required
              disabled={isSubmitting}
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">🔑 Password</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              required
              disabled={isSubmitting}
            />
          </div>

          <button type="submit" className="btn-login" disabled={isSubmitting}>
            {isSubmitting ? "Getting your wristband..." : "🎫 Get Wristband"}
          </button>
        </form>

        <div className="demo-section">
          <h3>🎯 Quick Demo Access</h3>
          <div className="demo-buttons">
            <button
              onClick={() => handleDemoLogin("visitor@park.com", "password123")}
              className="btn-demo visitor"
              disabled={isSubmitting}
            >
              🎫 Try as Visitor
            </button>
            <button
              onClick={() => handleDemoLogin("vip@park.com", "vipaccess")}
              className="btn-demo vip"
              disabled={isSubmitting}
            >
              👑 Try as VIP
            </button>
          </div>
          <div className="demo-info">
            <p>
              <strong>Visitor:</strong> Standard access to most rides
            </p>
            <p>
              <strong>VIP:</strong> Access to all rides including exclusive VIP
              areas
            </p>
          </div>
        </div>

        <div className="security-note">
          <p>
            🔒 Your wristband (JWT token) is securely stored and automatically
            verified.
          </p>
          <p>Tokens expire in 1 minute for demonstration purposes.</p>
        </div>
      </div>
    </div>
  );
}

// Park Dashboard Component
function ParkDashboard() {
  return (
    <>
      <WelcomeSection />
      <RideSections />
    </>
  );
}

// Welcome Component
function WelcomeSection() {
  const { user } = useContext(ParkContext);

  return (
    <div className="welcome-section">
      <div className="welcome-content">
        <h2>🎡 Welcome to the Park, {user?.email?.split("@")[0]}!</h2>
        <p className="welcome-message">
          Your <strong>{user?.role === "vip" ? "VIP" : "Visitor"}</strong>{" "}
          wristband gives you access to different areas of the park. Explore the
          rides below!
        </p>

        <div className="park-info">
          <div className="info-card">
            <div className="info-icon">🔐</div>
            <h3>How It Works</h3>
            <p>
              Your JWT wristband is automatically verified with every request to
              ensure security.
            </p>
          </div>

          <div className="info-card">
            <div className="info-icon">🎫</div>
            <h3>Your Access Level</h3>
            <p>
              You have{" "}
              <strong>{user?.role === "vip" ? "VIP" : "Standard"}</strong>{" "}
              access to park attractions.
            </p>
          </div>

          <div className="info-card">
            <div className="info-icon">⏰</div>
            <h3>Token Expiration</h3>
            <p>
              For demo purposes, your wristband expires in{" "}
              <strong>1 minute</strong> to show auto-logout.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

// Rides Component
function RideSections() {
  const { user, fetchRides } = useContext(ParkContext);
  const [activeSection, setActiveSection] = useState("");
  const [error, setError] = useState("");
  const [isLoadingRides, setIsLoadingRides] = useState(false);

  const handleFetchRides = async (section) => {
    setError("");
    setIsLoadingRides(true);
    setActiveSection(section);

    const result = await fetchRides(section);

    if (!result.success) {
      setError(result.message);
      if (result.expired) {
        setActiveSection("");
      }
    }

    setIsLoadingRides(false);
  };

  const sections = [
    {
      id: "public-rides",
      label: "🎪 Public Rides",
      description: "No wristband needed",
      access: "all",
    },
    {
      id: "protected-rides",
      label: "🎢 Protected Rides",
      description: "Valid wristband required",
      access: "authenticated",
    },
    {
      id: "vip-rides",
      label: "👑 VIP Rides",
      description: "VIP wristband only",
      access: "vip",
    },
  ];

  return (
    <div className="rides-section">
      <div className="section-header">
        <h2>🎯 Explore Park Attractions</h2>
        <p>Click on a section to see available rides</p>
      </div>

      <div className="ride-navigation">
        {sections.map((section) => {
          if (section.access === "vip" && user?.role !== "vip") return null;
          if (section.access === "authenticated" && !user) return null;

          return (
            <button
              key={section.id}
              onClick={() => handleFetchRides(section.id)}
              className={`ride-btn ${activeSection === section.id ? "active" : ""}`}
              disabled={isLoadingRides}
            >
              <span className="btn-label">{section.label}</span>
              <span className="btn-desc">{section.description}</span>
            </button>
          );
        })}
      </div>

      {error && (
        <div
          className={`error-message ${error.includes("expired") ? "expired" : ""}`}
        >
          <div className="error-content">
            <span className="error-icon">⚠️</span>
            <span className="error-text">{error}</span>
            {error.includes("expired") && (
              <button
                className="btn-refresh"
                onClick={() => window.location.reload()}
              >
                Refresh Page
              </button>
            )}
          </div>
        </div>
      )}

      <div className="rides-display-area">
        {activeSection && (
          <div className="rides-display">
            <div className="rides-header">
              <h3>{activeSection.replace("-", " ").toUpperCase()}</h3>
              {isLoadingRides && (
                <div className="loading-small">Loading rides...</div>
              )}
            </div>
            <RidesList section={activeSection} />
          </div>
        )}

        {!activeSection && !error && (
          <div className="empty-state">
            <div className="empty-icon">🎡</div>
            <h3>Select a Park Section</h3>
            <p>Choose one of the sections above to see available rides</p>
          </div>
        )}
      </div>
    </div>
  );
}

// Rides List Component
function RidesList({ section }) {
  const { rides } = useContext(ParkContext);
  const sectionRides = rides[section] || [];

  if (sectionRides.length === 0) {
    return (
      <div className="no-rides">
        <p>No rides available in this section or still loading...</p>
      </div>
    );
  }

  return (
    <div className="rides-grid">
      {sectionRides.map((ride, index) => (
        <div key={index} className="ride-card">
          <div className="ride-icon">🎡</div>
          <div className="ride-content">
            <h4>{ride}</h4>
            <div className="ride-status">
              <span className="status-dot available"></span>
              <span>Available</span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export default App;
