"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";

import { customerAuthClient } from "@/lib/customer-auth-client";

import styles from "../dang-nhap/customer-auth.module.css";

const MIN_PASSWORD_LENGTH = 8;

export function ResetPasswordForm({ token }: { token: string }) {
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isPending) return;
    setError("");

    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(`Mật khẩu cần ít nhất ${MIN_PASSWORD_LENGTH} ký tự.`);
      return;
    }
    if (password !== confirmation) {
      setError("Hai mật khẩu chưa giống nhau.");
      return;
    }

    setIsPending(true);
    try {
      const result = await customerAuthClient.resetPassword({ newPassword: password, token });
      if (result && typeof result === "object" && "error" in result && result.error) {
        setError("Liên kết đã hết hạn hoặc không hợp lệ. Hãy yêu cầu liên kết mới ở trang đăng nhập.");
        return;
      }
      setDone(true);
    } catch {
      setError("Chưa đổi được mật khẩu. Vui lòng thử lại sau.");
    } finally {
      setIsPending(false);
    }
  }

  if (done) {
    return (
      <>
        <p className={styles.formNotice} role="status" style={{ marginTop: 18 }}>
          Đã đổi mật khẩu. Bạn có thể đăng nhập bằng mật khẩu mới.
        </p>
        <Link className={styles.homeLink} href="/tai-khoan/dang-nhap/">Đến trang đăng nhập</Link>
      </>
    );
  }

  return (
    <form className={styles.authForm} onSubmit={submit} style={{ marginTop: 20 }}>
      <label className={styles.field}>
        <span>Mật khẩu mới</span>
        <input
          autoComplete="new-password"
          data-testid="input-reset-password"
          maxLength={128}
          minLength={MIN_PASSWORD_LENGTH}
          onChange={(event) => setPassword(event.target.value)}
          required
          type="password"
          value={password}
        />
      </label>
      <label className={styles.field}>
        <span>Nhập lại mật khẩu mới</span>
        <input
          autoComplete="new-password"
          data-testid="input-reset-confirmation"
          maxLength={128}
          minLength={MIN_PASSWORD_LENGTH}
          onChange={(event) => setConfirmation(event.target.value)}
          required
          type="password"
          value={confirmation}
        />
      </label>
      {error ? <p className={styles.formError} role="alert">{error}</p> : null}
      <button aria-busy={isPending} className={styles.submitButton} data-testid="button-reset-submit" disabled={isPending} type="submit">
        {isPending ? "Đang lưu…" : "Lưu mật khẩu mới"}
      </button>
    </form>
  );
}
