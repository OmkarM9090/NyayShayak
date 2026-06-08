import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';

export default function LoginPage() {
  const [isRegister, setIsRegister] = useState(false);
  const navigate = useNavigate();

  // State for form inputs
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: ''
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Handle Input Changes
  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  // Submit Logic
  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const endpoint = isRegister ? '/signup' : '/login';
    const url = `http://localhost:5000/api/auth${endpoint}`;

    try {
      const res = await axios.post(url, formData);

      if (!isRegister) {
        // LOGIN LOGIC: Save token and user details
        localStorage.setItem('token', res.data.token);
        localStorage.setItem('user', JSON.stringify(res.data.user));
        alert("Login Successful!");
        navigate('/chat'); // Go back to assistant/dashboard
      } else {
        // SIGNUP LOGIC: Switch to login mode
        alert("Account Created! Please Login.");
        setIsRegister(false);
      }
    } catch (err) {
      setError(err.response?.data?.msg || "Something went wrong. Try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-brand-base text-brand-primary p-6">
      <div className="bg-white p-8 rounded-2xl shadow-xl border border-brand-surface max-w-md w-full">
        
        <div className="text-center mb-8">
          <h2 className="text-3xl font-serif font-bold mb-2">
            {isRegister ? "Create an Account" : "Welcome Back"}
          </h2>
          <p className="opacity-80 text-sm">
            {isRegister ? "Sign up to save your legal analysis history." : "Log in to view your past document scans."}
          </p>
        </div>

        {/* Error Message Display */}
        {error && <div className="mb-4 p-3 bg-red-100 text-red-700 text-sm rounded-lg">{error}</div>}
        
        <form className="space-y-4 mb-6" onSubmit={handleSubmit}>
          {isRegister && (
            <div>
              <label className="block text-sm font-medium mb-1 opacity-80">Full Name</label>
              <input 
                name="name"
                type="text" 
                required
                value={formData.name}
                onChange={handleChange}
                placeholder="John Doe" 
                className="w-full p-3 rounded-lg border border-brand-surface bg-brand-base/30 focus:outline-none focus:ring-2 focus:ring-brand-accent" 
              />
            </div>
          )}
          <div>
            <label className="block text-sm font-medium mb-1 opacity-80">Email Address</label>
            <input 
              name="email"
              type="email" 
              required
              value={formData.email}
              onChange={handleChange}
              placeholder="you@example.com" 
              className="w-full p-3 rounded-lg border border-brand-surface bg-brand-base/30 focus:outline-none focus:ring-2 focus:ring-brand-accent" 
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1 opacity-80">Password</label>
            <input 
              name="password"
              type="password" 
              required
              value={formData.password}
              onChange={handleChange}
              placeholder="••••••••" 
              className="w-full p-3 rounded-lg border border-brand-surface bg-brand-base/30 focus:outline-none focus:ring-2 focus:ring-brand-accent" 
            />
          </div>
          
          <button 
            type="submit"
            disabled={loading}
            className="w-full bg-brand-primary text-brand-base py-3 rounded-lg font-bold hover:bg-brand-accent transition shadow-md disabled:opacity-50"
          >
            {loading ? "Processing..." : (isRegister ? "Sign Up" : "Sign In with Email")}
          </button>
        </form>

        {/* ... Rest of your Google Button and Footer ... */}
        
        <div className="text-center text-sm font-medium">
          <span className="opacity-80">
            {isRegister ? "Already have an account? " : "Don't have an account? "}
          </span>
          <button onClick={() => setIsRegister(!isRegister)} className="text-brand-accent hover:underline font-bold">
            {isRegister ? "Log In" : "Sign Up"}
          </button>
        </div>

        <div className="text-center mt-6">
          <Link to="/" className="text-xs font-medium hover:underline opacity-60">
            ← Back to Assistant
          </Link>
        </div>
      </div>
    </div>
  );
}