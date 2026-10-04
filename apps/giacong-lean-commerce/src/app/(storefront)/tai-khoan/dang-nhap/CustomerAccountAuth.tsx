"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

import { customerAuthClient, signInWithGoogle } from "@/lib/customer-auth-client";

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

export function CustomerAccountAuth({ callbackURL }: { callbackURL: string }) {
  const router = useRouter();
  const [mode, setMode] = useState<AuthMode>("sign-in");
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [unverifiedEmail, setUnverifiedEmail] = useState("");

  function changeMode(nextMode: AuthMode) {
    setMode(nextMode);
    setIdentifier("");
    setPassword("");
    setFullName("");
    setEmail("");
    setUsername("");
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
      const result = value.includes("@")
        ? await customerAuthClient.signIn.email({ callbackURL, email: value, password })
        : await customerAuthClient.signIn.username({ callbackURL, password, username: value });

      const code = getErrorCode(result);
      if (code === "EMAIL_NOT_VERIFIED") {
        setError("Email này chưa được xác nhận. Hãy mở email xác nhận chúng tôi đã gửi, hoặc gửi lại email mới.");
        if (value.includes("@")) setUnverifiedEmail(value);
        return;
      }
      if (code) {
        setError("Không thể đăng nhập. Hãy kiểm tra tên đăng nhập hoặc email và mật khẩu.");
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
    if (isPending) return;
    setError("");
    setNotice("");

    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(`Mật khẩu cần ít nhất ${MIN_PASSWORD_LENGTH} ký tự.`);
      return;
    }

    setIsPending(true);
    try {
      const trimmedUsername = username.trim();
      const result = await customerAuthClient.signUp.email({
        callbackURL,
        email: email.trim(),
        name: fullName.trim(),
        password,
        ...(trimmedUsername ? { username: trimmedUsername } : {}),
      });

      const code = getErrorCode(result);
      if (code === "EMAIL_PASSWORD_SIGN_UP_DISABLED" || /sign up is not enabled|sign-up is disabled/i.test(getErrorMessage(result))) {
        setError("Đăng ký bằng email chưa được bật. Vui lòng dùng nút Google bên dưới.");
        return;
      }
      if (code === "USERNAME_IS_ALREADY_TAKEN_PLEASE_TRY_ANOTHER" || code === "USERNAME_IS_ALREADY_TAKEN") {
        setError("Tên đăng nhập này đã có người dùng. Hãy chọn tên khác hoặc để trống.");
        return;
      }
      if (code === "INVALID_USERNAME" || code === "USERNAME_TOO_SHORT" || code === "USERNAME_TOO_LONG") {
        setError("Tên đăng nhập chưa hợp lệ (3–30 ký tự, chỉ gồm chữ không dấu, số, dấu chấm, gạch dưới).");
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

      setNotice("Đã gửi email xác nhận. Hãy mở email và bấm nút xác nhận để hoàn tất đăng ký (kiểm tra cả mục thư rác).");
      setPassword("");
    } catch {
      setError("Chưa xử lý được yêu cầu. Vui lòng thử lại sau.");
    } finally {
      setIsPending(false);
    }
  }

  async function requestReset(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isPending) return;
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
    setIsPending(true);
    setError("");
    setNotice("");
    try {
      const result = await signInWithGoogle(callbackURL);
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

      {mode === "sign-in" ? (
        <form className={styles.authForm} onSubmit={signIn}>
          <label className={styles.field}>
            <span>Tên đăng nhập hoặc email</span>
            <input
              autoComplete="username"
              data-testid="input-auth-identifier"
              maxLength={254}
              minLength={1}
              onChange={(event) => setIdentifier(event.target.value)}
              required
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
              type="password"
              value={password}
            />
          </label>
          {feedback}
          {unverifiedEmail ? (
            <button className={styles.linkButton} disabled={isPending} onClick={resendVerification} type="button">
              Gửi lại email xác nhận
            </button>
          ) : null}
          <button aria-busy={isPending} className={styles.submitButton} data-testid="button-auth-submit" disabled={isPending} type="submit">
            {isPending ? "Đang đăng nhập…" : "Đăng nhập"}
          </button>
          <button className={styles.linkButton} data-testid="button-auth-forgot" disabled={isPending} onClick={() => changeMode("forgot-password")} type="button">
            Quên mật khẩu?
          </button>
        </form>
      ) : null}

      {mode === "create-account" ? (
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
            <span>Mật khẩu (ít nhất {MIN_PASSWORD_LENGTH} ký tự)</span>
            <input
              autoComplete="new-password"
              data-testid="input-signup-password"
              maxLength={128}
              minLength={MIN_PASSWORD_LENGTH}
              onChange={(event) => setPassword(event.target.value)}
              required
              type="password"
              value={password}
            />
          </label>
          <label className={styles.field}>
            <span>Tên đăng nhập <small className={styles.optional}>(không bắt buộc)</small></span>
            <input
              autoComplete="username"
              data-testid="input-signup-username"
              maxLength={30}
              onChange={(event) => setUsername(event.target.value)}
              value={username}
            />
          </label>
          {feedback}
          <button aria-busy={isPending} className={styles.submitButton} data-testid="button-signup-submit" disabled={isPending} type="submit">
            {isPending ? "Đang tạo tài khoản…" : "Tạo tài khoản"}
          </button>
          <p className={styles.emailNote}>Chúng tôi sẽ gửi email xác nhận. Bạn cần xác nhận email trước khi đăng nhập.</p>
        </form>
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
          {feedback}
          <button aria-busy={isPending} className={styles.submitButton} data-testid="button-forgot-submit" disabled={isPending} type="submit">
            {isPending ? "Đang gửi…" : "Gửi liên kết đặt lại mật khẩu"}
          </button>
          <button className={styles.linkButton} disabled={isPending} onClick={() => changeMode("sign-in")} type="button">
            ← Quay lại đăng nhập
          </button>
        </form>
      ) : null}

      {mode !== "forgot-password" ? <p aria-hidden="true" className={styles.divider}><span>hoặc</span></p> : null}

      {mode !== "forgot-password" ? (
        <div className={styles.googleButtonWrap}>
          <button
            aria-busy={isPending}
            className="button primary is-large expand"
            disabled={isPending}
            onClick={googleSignIn}
            type="button"
          >
            {isPending
              ? "Đang kết nối Google…"
              : mode === "create-account" ? "Tạo tài khoản bằng Google" : "Tiếp tục với Google"}
          </button>
        </div>
      ) : null}
    </div>
  );
}
