import AuthForm from "@/components/auth/AuthForm";

export default function SignupPage() {
  return (
    <main className="page-container flex min-h-[70vh] items-center justify-center">
      <AuthForm mode="signup" />
    </main>
  );
}

