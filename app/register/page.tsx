"use client";

import { AuthLayout } from "@/components/auth/auth-layout";
import { degreePrograms } from "@/lib/degree-programs";
import { departmentOptions } from "@/lib/departments";
import { clearSession } from "@/lib/session";
import {
  digitsOnly,
  formFieldClassNames,
  isValidEmail,
  isValidPassword,
  isValidStudentId,
  passwordRequirementText,
} from "@/lib/utils";
import { notifyError } from "@/lib/notify";
import { Button, Input, Link, Select, SelectItem } from "@heroui/react";
import { Eye, EyeOff } from "lucide-react";
import NextLink from "next/link";
import { useState } from "react";
import type { UserRole } from "@/types";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

const academicYearOptions = [
  "2020/2021",
  "2021/2022",
  "2022/2023",
  "2023/2024",
  "2024/2025",
  "2025/2026",
  "2026/2027",
];

export default function RegisterPage() {
  const [role, setRole] = useState<UserRole>("student");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [emailValue, setEmailValue] = useState("");
  const [studentIdValue, setStudentIdValue] = useState("");
  const [passwordValue, setPasswordValue] = useState("");
  const [confirmPasswordValue, setConfirmPasswordValue] = useState("");

  const handleRegister = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      const formData = new FormData(e.currentTarget);
      const firstName = formData.get("firstName") as string;
      const lastName = formData.get("lastName") as string;
      const email = formData.get("email") as string;
      const password = formData.get("password") as string;
      const confirmPassword = formData.get("confirmPassword") as string;
      const studentId = formData.get("studentId") as string;

      if (!isValidEmail(email)) {
        notifyError("Please enter a valid email address with @ sign.");
        return;
      }

      if (!password) {
        notifyError("Please enter a password.");
        return;
      }

      if (!isValidPassword(password)) {
        notifyError(passwordRequirementText);
        return;
      }

      if (password !== confirmPassword) {
        notifyError("Passwords do not match.");
        return;
      }

      if (role === "student" && !isValidStudentId(studentId)) {
        notifyError("Student ID must be exactly 6 digits, for example 222111.");
        return;
      }

      const payload = {
        name: `${firstName} ${lastName}`,
        email,
        password,
        role,
        student_id: role === "student" ? studentId : null,
        department: formData.get("department") as string || null,
        program: role === "student" ? formData.get("program") as string : null,
        year: role === "student" ? formData.get("year") as string : null,
        batch: role === "student" ? formData.get("batch") as string : null,
        academic_year: role === "student" ? formData.get("academicYear") as string : null,
        title: role === "supervisor" || role === "external_supervisor" ? formData.get("title") as string : null,
      };

      clearSession();

      const response = await fetch(`${API_BASE}/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        console.error("Registration error:", JSON.stringify(result, null, 2));
        notifyError("Failed to register: " + (result.message || "Unable to register"));
      } else {
        // Redirect to login page after successful registration
        window.location.href = "/login";
      }
    } catch (err: any) {
      console.error(err);
      notifyError(err.message || "An unexpected error occurred.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout title="Create account" subtitle="Register to start your internship journey">
      <form onSubmit={handleRegister} className="space-y-4">
        <Select
          label="Register as"
          selectedKeys={[role]}
          onSelectionChange={(keys) => {
            const selected = Array.from(keys)[0] as UserRole;
            if (selected) setRole(selected);
          }}
          variant="bordered"
          radius="lg"
          classNames={formFieldClassNames}
        >
          <SelectItem key="student">Student</SelectItem>
          <SelectItem key="supervisor">Supervisor</SelectItem>
          <SelectItem key="external_supervisor">External Supervisor</SelectItem>
        </Select>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input name="firstName" label="First Name" placeholder="Nimal" variant="bordered" radius="lg" isRequired classNames={formFieldClassNames} />
          <Input name="lastName" label="Last Name" placeholder="Perera" variant="bordered" radius="lg" isRequired classNames={formFieldClassNames} />
        </div>

        <Input
          name="email"
          label="Email"
          type="email"
          placeholder="you@university.edu"
          value={emailValue}
          onValueChange={setEmailValue}
          variant="bordered"
          radius="lg"
          isRequired
          isInvalid={!!emailValue && !isValidEmail(emailValue)}
          errorMessage="Email must include @ sign."
          classNames={formFieldClassNames}
        />

        {role === "student" && (
          <>
            <Input
              name="studentId"
              label="Student ID"
              placeholder="123456"
              value={studentIdValue}
              onValueChange={(value) => setStudentIdValue(digitsOnly(value, 6))}
              inputMode="numeric"
              maxLength={6}
              variant="bordered"
              radius="lg"
              isRequired
              isInvalid={!!studentIdValue && !isValidStudentId(studentIdValue)}
              errorMessage="Student ID must be exactly 6 digits, for example 222111."
              classNames={formFieldClassNames}
            />
            <Select name="department" label="Department" variant="bordered" radius="lg" classNames={formFieldClassNames}>
              {departmentOptions.map((department) => (
                <SelectItem key={department}>{department}</SelectItem>
              ))}
            </Select>
            <Select name="program" label="Program" variant="bordered" radius="lg" classNames={formFieldClassNames}>
              {degreePrograms.map((program) => (
                <SelectItem key={program}>{program}</SelectItem>
              ))}
            </Select>
            <Select name="academicYear" label="Academic Year" variant="bordered" radius="lg" classNames={formFieldClassNames}>
              {academicYearOptions.map((academicYear) => (
                <SelectItem key={academicYear}>{academicYear}</SelectItem>
              ))}
            </Select>
            <div className="grid grid-cols-2 gap-4">
              <Input name="year" label="Year" placeholder="2" variant="bordered" radius="lg" classNames={formFieldClassNames} />
              <Input name="batch" label="Batch" placeholder="2022" variant="bordered" radius="lg" classNames={formFieldClassNames} />
            </div>
          </>
        )}

        {role === "supervisor" && (
          <>
            <Input name="title" label="Title" placeholder="Dr. / Mr. / Ms." variant="bordered" radius="lg" classNames={formFieldClassNames} />
            <Select name="department" label="Department" variant="bordered" radius="lg" isRequired classNames={formFieldClassNames}>
              {departmentOptions.map((department) => (
                <SelectItem key={department}>{department}</SelectItem>
              ))}
            </Select>
          </>
        )}

        <Input
          name="password"
          label="Password"
          type={showPassword ? "text" : "password"}
          placeholder="Create a password"
          variant="bordered"
          radius="lg"
          isRequired
          value={passwordValue}
          onValueChange={setPasswordValue}
          isInvalid={!!passwordValue && !isValidPassword(passwordValue)}
          errorMessage={passwordRequirementText}
          classNames={formFieldClassNames}
          endContent={
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="text-text-secondary hover:text-text-primary"
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          }
        />

        <Input
          name="confirmPassword"
          label="Confirm Password"
          type="password"
          placeholder="Confirm your password"
          variant="bordered"
          radius="lg"
          isRequired
          value={confirmPasswordValue}
          onValueChange={setConfirmPasswordValue}
          isInvalid={!!confirmPasswordValue && confirmPasswordValue !== passwordValue}
          errorMessage="Passwords do not match."
          classNames={formFieldClassNames}
        />

        <Button type="submit" color="primary" size="lg" radius="lg" className="w-full font-semibold" isLoading={loading}>
          Create Account
        </Button>

        <p className="text-center text-sm text-text-secondary">
          Already have an account?{" "}
          <Link as={NextLink} href="/login" size="sm" color="primary">
            Sign in
          </Link>
        </p>
      </form>
    </AuthLayout>
  );
}
