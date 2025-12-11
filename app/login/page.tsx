import AuthForm from "@/components/auth/AuthForm";

export default function LoginPage() {
  return (
    <main className="page-container flex min-h-[70vh] items-center justify-center">
      <AuthForm mode="login" />
    </main>
  );
}

