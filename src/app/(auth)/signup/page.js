'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Eye,
  EyeOff,
  AlertCircle,
  Rocket,
} from 'lucide-react';
import styles from '@/styles/auth.module.css';

export default function SignupPage() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }

    setLoading(true);

    try {
      // TODO: Replace with Supabase auth when connected
      await new Promise((resolve) => setTimeout(resolve, 800));
      router.push('/demo');
    } catch (err) {
      setError('Could not create account. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.authContainer}>
      {/* Animated background orbs */}
      <div className={styles.authBackground}>
        <div className={styles.authOrb} />
        <div className={styles.authOrb} />
        <div className={styles.authOrb} />
      </div>

      {/* Left: Branding Panel */}
      <div className={styles.authBrandPanel}>
        <div className={styles.brandContent}>
          <div className={styles.brandLogo}>
            <div className={styles.brandLogoIcon}>⚡</div>
            <span className={styles.brandLogoText}>ImpactNotion</span>
          </div>

          <p className={styles.brandTagline}>
            Create your workspace and start organizing your community
            operations with powerful documents and databases.
          </p>

          <div className={styles.brandFeatures}>
            <div className={styles.brandFeature}>
              <span className={styles.brandFeatureIcon}>
                <Rocket size={16} />
              </span>
              Get started in seconds — no credit card required
            </div>
          </div>
        </div>
      </div>

      {/* Right: Signup Form */}
      <div className={styles.authFormPanel}>
        <div className={styles.authCard}>
          <h1 className={styles.authTitle}>Create your account</h1>
          <p className={styles.authSubtitle}>
            Already have an account?{' '}
            <Link href="/login">Sign in</Link>
          </p>

          {error && (
            <div className={styles.authError}>
              <AlertCircle size={16} />
              {error}
            </div>
          )}

          <form className={styles.authForm} onSubmit={handleSubmit}>
            <div className={styles.formGroup}>
              <label className={styles.formLabel} htmlFor="signup-name">
                Full name
              </label>
              <input
                id="signup-name"
                className={styles.formInput}
                type="text"
                placeholder="Your name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                autoComplete="name"
              />
            </div>

            <div className={styles.formGroup}>
              <label className={styles.formLabel} htmlFor="signup-email">
                Email
              </label>
              <input
                id="signup-email"
                className={styles.formInput}
                type="email"
                placeholder="your@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
              />
            </div>

            <div className={styles.formGroup}>
              <label className={styles.formLabel} htmlFor="signup-password">
                Password
              </label>
              <div className={styles.formInputWrapper}>
                <input
                  id="signup-password"
                  className={`${styles.formInput} ${styles.formInputWithIcon}`}
                  type={showPassword ? 'text' : 'password'}
                  placeholder="At least 6 characters"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  className={styles.formInputIcon}
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              className={styles.authSubmitBtn}
              disabled={loading}
            >
              {loading ? (
                <span className={styles.authSubmitBtnLoading}>
                  <span className={styles.authSpinner} />
                  Creating account...
                </span>
              ) : (
                'Create account'
              )}
            </button>
          </form>

          <div className={styles.authDivider}>
            <div className={styles.authDividerLine} />
            <span className={styles.authDividerText}>or</span>
            <div className={styles.authDividerLine} />
          </div>

          <button
            className={styles.authDemoBtn}
            onClick={() => router.push('/demo')}
          >
            <Rocket size={16} />
            Try demo workspace
          </button>
        </div>
      </div>
    </div>
  );
}
