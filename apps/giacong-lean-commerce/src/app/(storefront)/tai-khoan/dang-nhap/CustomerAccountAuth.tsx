"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

import { customerAuthClient, signInWithGoogle } from "@/lib/customer-auth-client";
import { parseCustomerContact } from "@/lib/customer-contact-input";

import styles from "./customer-auth.module.css";

type AuthMode = "sign-in" | "create-account" | "forgot-password";

function getErrorCode(result: unknown): string {
  if (typeof result !== "object" || result === null || !("error" in result)) return "";
  const error = result.error;
  if (typeof error !== "object" || error === null) return error ? "UNKNOWN" : "";
  return "code" in error && typeof error.code === "string" ? error.code : "UNKNOWN";
}

function getErrorMessage(result: unknown): string {
  if (typeof result !== "object" || result === null || !("error" in result)) return "";
  const error = result.error;
  return typeof error === "object" && error !== null && "message" in error && typeof error.message === "string"
    ? error.message
    : "";
}

const MIN_PASSWORD_LENGTH = 8;
const ACCOUNT_CALLBACK_ORIGIN = "https://account.local";

function googleCreateAccountCallback(callbackURL: string): string {
  const destination = new URL(callbackURL, ACCOUNT_CALLBACK_ORIGIN);
  const continuation = `${destination.pathname}${destination.search}${destination.hash}`;
  const callback = new URL("/tai-khoan/", ACCOUNT_CALLBACK_ORIGIN);
  callback.searchParams.set("welcome", "google");
  if (continuation !== "/tai-khoan/" && continuation !== "/tai-khoan") {
    callback.searchParams.set("next", continuation);
  }
  return `${callback.pathname}${callback.search}`;
}

export function CustomerAccountAuth({ callbackURL, emailRegistrationEnabled = false, emailDeliveryEnabled = emailRegistrationEnabled }: { callbackURL: string; emailRegistrationEnabled?: boolean; emailDeliveryEnabled?: boolean }) {
  const router = useRouter();
  const [mode, setMode] = useState<AuthMode>("sign-in");
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [consent, setConsent] = useState(false);
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [unverifiedEmail, setUnverifiedEmail] = useState("");
  const [registrationComplete, setRegistrationComplete] = useState(false);

  function changeMode(nextMode: AuthMode) {
    setRegistrationComplete(false);
    setMode(nextMode);
    setIdentifier("");
    setPassword("");
    setConfirmation("");
    setShowPassword(false);
    setFullName("");
    setEmail("");
    setPhone("");
    setConsent(false);
    setError("");
    setNotice("");
    setUnverifiedEmail("");
  }

  async function signIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isPending) return;

    setIsPending(true);
    setError("");
    setNotice("");
    setUnverifiedEmail("");

    try {
      const value = identifier.trim();
      const result = await customerAuthClient.signIn.email({ callbackURL, email: value, password });

      const code = getErrorCode(result);
      if (code === "EMAIL_NOT_VERIFIED") {
        setError(emailDeliveryEnabled
          ? "Email này chưa được xác nhận. Hãy mở email xác nhận chúng tôi đã gửi, hoặc gửi lại email mới."
          : "Email này chưa được xác nhận. Vui lòng đăng nhập bằng Google để tiếp tục.");
        if (emailDeliveryEnabled && value.includes("@")) setUnverifiedEmail(value);
        return;
      }
      if (code) {
        setError("Không thể đăng nhập. Hãy kiểm tra email và mật khẩu.");
        return;
      }

      router.replace(callbackURL);
      router.refresh();
    } catch {
      setError("Chưa thể xử lý yêu cầu. Vui lòng thử lại sau.");
    } finally {
      setIsPending(false);
    }
  }

  async function resendVerification() {
    if (isPending || !unverifiedEmail) return;
    setIsPending(true);
    setError("");
    try {
      const result = await customerAuthClient.sendVerificationEmail({ callbackURL, email: unverifiedEmail });
      if (getErrorCode(result)) {
        setError("Chưa gửi lại được email xác nhận. Vui lòng thử lại sau.");
        return;
      }
      setNotice("Đã gửi lại email xác nhận. Hãy kiểm tra hộp thư (cả mục thư rác).");
      setUnverifiedEmail("");
    } catch {
      setError("Chưa gửi lại được email xác nhận. Vui lòng thử lại sau.");
    } finally {
      setIsPending(false);
    }
  }

  async function createAccount(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isPending || !emailRegistrationEnabled) return;
    setError("");
    setNotice("");

    const contact = parseCustomerContact({ name: fullName, phone, consent });
    if (!contact.ok) {
      setError(Object.values(contact.errors)[0] ?? "Vui lòng kiểm tra thông tin liên hệ.");
      return;
    }
    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(`Mật khẩu cần ít nhất ${MIN_PASSWORD_LENGTH} ký tự.`);
      return;
    }
    if (password !== confirmation) {
      setError("Hai mật khẩu chưa giống nhau. Vui lòng kiểm tra lại.");
      return;
    }

    setIsPending(true);
    try {
      const response = await fetch("/api/auth/sign-up/email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ callbackURL, email: email.trim(), name: contact.value.name, password, phone: contact.value.phone, consent }),
      });
      const body = await response.json();
      const result = response.ok ? body : { error: body };

      const code = getErrorCode(result);
      if (code === "EMAIL_PASSWORD_SIGN_UP_DISABLED" || /sign up is not enabled|sign-up is disabled/i.test(getErrorMessage(result))) {
        setError("Đăng ký bằng email chưa được bật. Vui lòng dùng nút Google bên dưới.");
        return;
      }
      if (code === "PASSWORD_TOO_SHORT" || code === "PASSWORD_TOO_LONG") {
        setError(`Mật khẩu cần từ ${MIN_PASSWORD_LENGTH} đến 128 ký tự.`);
        return;
      }
      if (code) {
        setError("Chưa tạo được tài khoản. Hãy kiểm tra thông tin và thử lại.");
        return;
      }

      setUnverifiedEmail(email.trim());
      setNotice("");
      setPassword("");
      setConfirmation("");
      setShowPassword(false);
      setFullName("");
      setPhone("");
      setConsent(false);
      setRegistrationComplete(true);
    } catch {
      setError("Chưa xử lý được yêu cầu. Vui lòng thử lại sau.");
    } finally {
      setIsPending(false);
    }
  }

  async function requestReset(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isPending || !emailDeliveryEnabled) return;
    setError("");
    setNotice("");
    setIsPending(true);
    try {
      const result = await customerAuthClient.requestPasswordReset({
        email: email.trim(),
        redirectTo: "/tai-khoan/dat-lai-mat-khau/",
      });
      if (getErrorCode(result)) {
        setError("Chưa gửi được email đặt lại mật khẩu. Vui lòng thử lại sau.");
        return;
      }
      // Same message whether or not the address has an account (no account enumeration).
      setNotice("Nếu email này có tài khoản, chúng tôi đã gửi liên kết đặt lại mật khẩu. Liên kết có hiệu lực trong 1 giờ.");
    } catch {
      setError("Chưa xử lý được yêu cầu. Vui lòng thử lại sau.");
    } finally {
      setIsPending(false);
    }
  }

  async function googleSignIn() {
    if (isPending) return;
    setIsPending(true);
    setError("");
    setNotice("");
    try {
      const result = await signInWithGoogle(mode === "create-account" ? googleCreateAccountCallback(callbackURL) : callbackURL);
      if (getErrorCode(result) || getErrorMessage(result)) {
        setError("Chưa thể đăng nhập bằng Google. Vui lòng thử lại sau.");
        setIsPending(false);
      }
    } catch {
      setError("Chưa thể đăng nhập bằng Google. Vui lòng thử lại sau.");
      setIsPending(false);
    }
  }

  const feedback = (
    <>
      {error ? <p className={styles.formError} role="alert">{error}</p> : null}
      {notice ? <p className={styles.formNotice} role="status">{notice}</p> : null}
    </>
  );

  return (
    <div className={styles.authMethods}>
      {registrationComplete ? (
        <section aria-labelledby="registration-complete-heading" className={styles.registrationSuccess}>
          <h3 id="registration-complete-heading">Tài khoản đã được tạo</h3>
          <p>Chúng tôi đã gửi liên kết xác nhận đến <strong>{email}</strong>. Mở email để xác nhận trước khi đăng nhập; nhớ kiểm tra cả thư rác.</p>
          {unverifiedEmail ? <button className={styles.linkButton} disabled={isPending} onClick={resendVerification} type="button">Gửi lại email xác nhận</button> : null}
          <button className={styles.submitButton} disabled={isPending} onClick={() => { const registeredEmail = email; changeMode("sign-in"); setIdentifier(registeredEmail); }} type="button">Đăng nhập</button>
        </section>
      ) : <>
      {mode !== "forgot-password" ? (
        <div aria-label="Chọn thao tác tài khoản" className={styles.modeSwitcher} role="group">
          <button
            aria-pressed={mode === "sign-in"}
            className={mode === "sign-in" ? styles.modeActive : ""}
            data-testid="auth-mode-sign-in"
            disabled={isPending}
            onClick={() => changeMode("sign-in")}
            type="button"
          >
            Đăng nhập
          </button>
          <button
            aria-pressed={mode === "create-account"}
            className={mode === "create-account" ? styles.modeActive : ""}
            data-testid="auth-mode-create-account"
            disabled={isPending}
            onClick={() => changeMode("create-account")}
            type="button"
          >
            Tạo tài khoản
          </button>
        </div>
      ) : null}

      <h3 className={styles.modeTitle}>{mode === "create-account" ? "Tạo tài khoản" : mode === "forgot-password" ? "Quên mật khẩu" : "Đăng nhập"}</h3>
      {mode !== "forgot-password" ? (
        <div className={styles.googleButtonWrap}>
          <p className={styles.methodCopy}>{mode === "create-account"
            ? "Tạo tài khoản bằng Google, không cần đặt mật khẩu riêng."
            : "Dùng tài khoản Google của bạn để tiếp tục."}</p>
          <button aria-busy={isPending} className="button primary is-large expand" disabled={isPending} onClick={googleSignIn} type="button">
            {isPending ? "Đang kết nối Google…" : mode === "create-account" ? "Tạo tài khoản bằng Google" : "Đăng nhập bằng Google"}
          </button>
        </div>
      ) : null}
      {mode === "sign-in" ? (
        <section aria-label="Đăng nhập bằng mật khẩu" className={styles.passwordOption}>
          <p className={styles.divider}>hoặc dùng email và mật khẩu</p>
        <form className={styles.authForm} onSubmit={signIn}>
          <label className={styles.field}>
            <span>Email</span>
            <input
              autoComplete="username"
              data-testid="input-auth-identifier"
              maxLength={254}
              minLength={1}
              onChange={(event) => setIdentifier(event.target.value)}
              required
              type="email"
              value={identifier}
            />
          </label>
          <label className={styles.field}>
            <span>Mật khẩu</span>
            <input
              autoComplete="current-password"
              data-testid="input-auth-password"
              maxLength={128}
              onChange={(event) => setPassword(event.target.value)}
              required
              type={showPassword ? "text" : "password"}
              value={password}
            />
          </label>
          <label className={styles.showPassword}><input checked={showPassword} onChange={(event) => setShowPassword(event.target.checked)} type="checkbox" />Hiện mật khẩu</label>
          {unverifiedEmail ? (
            <button className={styles.linkButton} disabled={isPending} onClick={resendVerification} type="button">
              Gửi lại email xác nhận
            </button>
          ) : null}
          <button aria-busy={isPending} className={styles.submitButton} data-testid="button-auth-submit" disabled={isPending} type="submit">
            {isPending ? "Đang đăng nhập…" : "Đăng nhập"}
          </button>
          {emailDeliveryEnabled ? <button className={styles.linkButton} data-testid="button-auth-forgot" disabled={isPending} onClick={() => changeMode("forgot-password")} type="button">
            Quên mật khẩu?
          </button> : null}
        </form>
        </section>
      ) : null}

      {mode === "create-account" && emailRegistrationEnabled ? (
        <section aria-label="Tạo tài khoản bằng email" className={styles.passwordOption}>
          <p className={styles.divider}>hoặc dùng email và mật khẩu</p>
        <form className={styles.authForm} onSubmit={createAccount}>
          <label className={styles.field}>
            <span>Họ và tên</span>
            <input
              autoComplete="name"
              data-testid="input-signup-name"
              maxLength={100}
              onChange={(event) => setFullName(event.target.value)}
              required
              value={fullName}
            />
          </label>
          <label className={styles.field}>
            <span>Email</span>
            <input
              autoComplete="email"
              data-testid="input-signup-email"
              maxLength={254}
              onChange={(event) => setEmail(event.target.value)}
              required
              type="email"
              value={email}
            />
          </label>
          <label className={styles.field}>
            <span>Số điện thoại</span>
            <input
              autoComplete="tel"
              data-testid="input-signup-phone"
              inputMode="tel"
              maxLength={24}
              onChange={(event) => setPhone(event.target.value)}
              required
              type="tel"
              value={phone}
            />
          </label>
          <label className={styles.field}>
            <span>Mật khẩu (ít nhất {MIN_PASSWORD_LENGTH} ký tự)</span>
            <input
              autoComplete="new-password"
              data-testid="input-signup-password"
              maxLength={128}
              minLength={MIN_PASSWORD_LENGTH}
              onChange={(event) => setPassword(event.target.value)}
              required
              type={showPassword ? "text" : "password"}
              value={password}
            />
          </label>
          <label className={styles.field}>
            <span>Nhập lại mật khẩu</span>
            <input autoComplete="new-password" maxLength={128} minLength={MIN_PASSWORD_LENGTH} onChange={(event) => setConfirmation(event.target.value)} required type={showPassword ? "text" : "password"} value={confirmation} />
          </label>
          <label className={styles.showPassword}><input checked={showPassword} onChange={(event) => setShowPassword(event.target.checked)} type="checkbox" />Hiện mật khẩu</label>
          <label className={styles.showPassword}><input checked={consent} onChange={(event) => setConsent(event.target.checked)} required type="checkbox" />
            <span>Tôi đồng ý lưu thông tin để được liên hệ tư vấn theo <Link href="/chinh-sach-bao-mat/">chính sách bảo mật</Link>.</span>
          </label>
          <button aria-busy={isPending} className={styles.submitButton} data-testid="button-signup-submit" disabled={isPending} type="submit">
            {isPending ? "Đang tạo tài khoản…" : "Tạo tài khoản"}
          </button>
          <p className={styles.emailNote}>Chúng tôi sẽ gửi email xác nhận. Bạn cần xác nhận email trước khi đăng nhập.</p>
        </form>
        </section>
      ) : null}

      {mode === "create-account" && !emailRegistrationEnabled ? (
        <p className={styles.emailNote}>{emailDeliveryEnabled ? "Đăng ký bằng email hiện được tắt. Bạn có thể tạo tài khoản bằng Google." : "Đăng ký bằng email đang được thiết lập. Hiện bạn có thể tạo tài khoản bằng Google."}</p>
      ) : null}

      {mode === "forgot-password" ? (
        <form className={styles.authForm} onSubmit={requestReset}>
          <p className={styles.emailNote}>Nhập email đã đăng ký. Chúng tôi sẽ gửi liên kết để bạn đặt mật khẩu mới.</p>
          <label className={styles.field}>
            <span>Email</span>
            <input
              autoComplete="email"
              data-testid="input-forgot-email"
              maxLength={254}
              onChange={(event) => setEmail(event.target.value)}
              required
              type="email"
              value={email}
            />
          </label>
          <button aria-busy={isPending} className={styles.submitButton} data-testid="button-forgot-submit" disabled={isPending} type="submit">
            {isPending ? "Đang gửi…" : "Gửi liên kết đặt lại mật khẩu"}
          </button>
          <button className={styles.linkButton} disabled={isPending} onClick={() => changeMode("sign-in")} type="button">
            ← Quay lại đăng nhập
          </button>
        </form>
      ) : null}
      </>}

      <div aria-live="polite" className={styles.feedback}>{feedback}</div>
    </div>
  );
}
