'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import {
  Eye,
  EyeOff,
  FileText,
  Database,
  Layout,
  Users,
  AlertCircle,
  Rocket,
} from 'lucide-react';
import Logo from '@/components/ui/Logo';
import styles from '@/styles/auth.module.css';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const supabase = createClient();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        setError(error.message);
      } else {
        router.push('/');
        router.refresh();
      }
    } catch (err) {
      setError('Invalid email or password. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleDemoAccess = () => {
    router.push('/demo');
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
          <div style={{ marginBottom: '2.5rem' }}>
            <Logo variant="primary" showText={true} textType="grid" width={48} height={48} />
          </div>

          <p className={styles.brandTagline}>
            Your workspace for organizing Impact360&apos;s community operations
            — documents, databases, events, and teams in one place.
          </p>

          <div className={styles.brandFeatures}>
            <div className={styles.brandFeature}>
              <span className={styles.brandFeatureIcon}>
                <FileText size={16} />
              </span>
              Rich document editor with blocks, embeds, and formatting
            </div>
            <div className={styles.brandFeature}>
              <span className={styles.brandFeatureIcon}>
                <Database size={16} />
              </span>
              Powerful databases with table, kanban, calendar views
            </div>
            <div className={styles.brandFeature}>
              <span className={styles.brandFeatureIcon}>
                <Layout size={16} />
              </span>
              Track agencies, assets, events, and income
            </div>
            <div className={styles.brandFeature}>
              <span className={styles.brandFeatureIcon}>
                <Users size={16} />
              </span>
              Manage members and WhatsApp groups
            </div>
          </div>
        </div>
      </div>

      {/* Right: Login Form */}
      <div className={styles.authFormPanel}>
        <div className={styles.authCard}>
          <h1 className={styles.authTitle}>Welcome back</h1>
          <p className={styles.authSubtitle}>
            Don&apos;t have an account?{' '}
            <Link href="/signup">Sign up</Link>
          </p>

          {error && (
            <div className={styles.authError}>
              <AlertCircle size={16} />
              {error}
            </div>
          )}

          <form className={styles.authForm} onSubmit={handleSubmit}>
            <div className={styles.formGroup}>
              <label className={styles.formLabel} htmlFor="login-email">
                Email
              </label>
              <input
                id="login-email"
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
              <label className={styles.formLabel} htmlFor="login-password">
                Password
              </label>
              <div className={styles.formInputWrapper}>
                <input
                  id="login-password"
                  className={`${styles.formInput} ${styles.formInputWithIcon}`}
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
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
                  Signing in...
                </span>
              ) : (
                'Sign in'
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
            onClick={handleDemoAccess}
          >
            <Rocket size={16} />
            Try demo workspace
          </button>
        </div>
      </div>
    </div>
  );
}
