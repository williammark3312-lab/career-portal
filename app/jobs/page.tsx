"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { supabase } from "../../src/lib/supabase";
import { ArrowRight, MapPin, Briefcase, Search } from "lucide-react";
import Header from "../../src/components/Header";

type Job = {
  id: string;
  title: string;
  department: string;
  location: string;
  description: string;
};

const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.07 } },
};

const cardVariant = {
  hidden: { opacity: 0, y: 24 },
  show: { opacity: 1, y: 0, transition: { duration: 0.55, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] } },
};

export default function JobsPage() {
  const router = useRouter();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedDept, setSelectedDept] = useState("");
  const [selectedLoc, setSelectedLoc] = useState("");

  useEffect(() => { fetchJobs(); }, []);

  async function fetchJobs() {
    setLoading(true);
    const { data, error } = await supabase
      .from("jobs")
      .select("*")
      .order("created_at", { ascending: false });
    if (!error && data) setJobs(data);
    setLoading(false);
  }

  const departments = Array.from(new Set(jobs.map(j => j.department))).filter(Boolean);
  const locations = Array.from(new Set(jobs.map(j => j.location))).filter(Boolean);

  const filteredJobs = jobs.filter(job => {
    const matchesSearch =
      job.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      job.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesDept = selectedDept ? job.department === selectedDept : true;
    const matchesLoc = selectedLoc ? job.location === selectedLoc : true;
    return matchesSearch && matchesDept && matchesLoc;
  });

  return (
    <main
      style={{
        display: "flex",
        flexDirection: "column",
        minHeight: "100vh",
        background: "transparent",
        color: "var(--white)",
      }}
    >
      <Header />

      {/* ── Page Hero ── */}
      <section
        style={{
          borderBottom: "1px solid var(--border)",
          padding: "80px 40px 60px",
        }}
      >
        <div style={{ maxWidth: 1280, margin: "0 auto" }}>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          >
            <p
              style={{
                fontSize: 12,
                fontWeight: 500,
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                color: "var(--fg-muted)",
                marginBottom: 20,
              }}
            >
              Open Positions
            </p>
            <h1
              style={{
                fontSize: "clamp(40px, 6vw, 72px)",
                fontWeight: 700,
                letterSpacing: "-0.04em",
                lineHeight: 1.0,
                color: "var(--white)",
                marginBottom: 20,
                fontFamily: '"Geist", ui-sans-serif, system-ui, sans-serif',
              }}
            >
              Build your career.
            </h1>
            <p
              style={{
                fontSize: 16,
                lineHeight: 1.65,
                color: "var(--fg-muted)",
                maxWidth: 440,
              }}
            >
              Explore roles across our teams. Ambitious people building things
              that matter.
            </p>
          </motion.div>
        </div>
      </section>

      {/* ── Search & Filters ── */}
      {!loading && jobs.length > 0 && (
        <section
          style={{
            borderBottom: "1px solid var(--border)",
            padding: "20px 40px",
          }}
        >
          <div
            style={{
              maxWidth: 1280,
              margin: "0 auto",
              display: "flex",
              gap: 12,
              flexWrap: "wrap",
              alignItems: "center",
            }}
          >
            {/* Search */}
            <div style={{ position: "relative", flex: "1 1 260px", minWidth: 0 }}>
              <Search
                style={{
                  position: "absolute",
                  left: 14,
                  top: "50%",
                  transform: "translateY(-50%)",
                  width: 15,
                  height: 15,
                  color: "var(--fg-muted)",
                  pointerEvents: "none",
                }}
              />
              <input
                type="text"
                placeholder="Search by title or keyword"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                style={{
                  width: "100%",
                  paddingLeft: 40,
                  paddingRight: 16,
                  paddingTop: 10,
                  paddingBottom: 10,
                  background: "var(--black-200)",
                  border: "1px solid var(--border)",
                  borderRadius: 8,
                  fontSize: 14,
                  color: "var(--white)",
                  outline: "none",
                  fontFamily: '"Geist", ui-sans-serif, system-ui, sans-serif',
                  transition: "border-color 0.2s",
                }}
                onFocus={e => (e.target.style.borderColor = "var(--border-strong)")}
                onBlur={e => (e.target.style.borderColor = "var(--border)")}
              />
            </div>

            {/* Department filter */}
            <select
              value={selectedDept}
              onChange={e => setSelectedDept(e.target.value)}
              style={{
                flex: "0 0 auto",
                padding: "10px 14px",
                background: "var(--black-200)",
                border: "1px solid var(--border)",
                borderRadius: 8,
                fontSize: 14,
                color: selectedDept ? "var(--white)" : "var(--fg-muted)",
                outline: "none",
                cursor: "pointer",
                fontFamily: '"Geist", ui-sans-serif, system-ui, sans-serif',
              }}
            >
              <option value="">All Departments</option>
              {departments.map(d => <option key={d} value={d}>{d}</option>)}
            </select>

            {/* Location filter */}
            <select
              value={selectedLoc}
              onChange={e => setSelectedLoc(e.target.value)}
              style={{
                flex: "0 0 auto",
                padding: "10px 14px",
                background: "var(--black-200)",
                border: "1px solid var(--border)",
                borderRadius: 8,
                fontSize: 14,
                color: selectedLoc ? "var(--white)" : "var(--fg-muted)",
                outline: "none",
                cursor: "pointer",
                fontFamily: '"Geist", ui-sans-serif, system-ui, sans-serif',
              }}
            >
              <option value="">All Locations</option>
              {locations.map(l => <option key={l} value={l}>{l}</option>)}
            </select>

            {/* Job count */}
            {(searchQuery || selectedDept || selectedLoc) && (
              <span style={{ fontSize: 13, color: "var(--fg-muted)", whiteSpace: "nowrap" }}>
                {filteredJobs.length} result{filteredJobs.length !== 1 ? "s" : ""}
                {" "}·{" "}
                <button
                  onClick={() => { setSearchQuery(""); setSelectedDept(""); setSelectedLoc(""); }}
                  style={{
                    background: "none",
                    border: "none",
                    color: "var(--white)",
                    cursor: "pointer",
                    fontSize: 13,
                    fontFamily: "inherit",
                    padding: 0,
                    textDecoration: "underline",
                    textUnderlineOffset: 3,
                  }}
                >
                  Clear
                </button>
              </span>
            )}
          </div>
        </section>
      )}

      {/* ── Job Listings ── */}
      <section style={{ flex: 1, padding: "0 40px 80px", maxWidth: 1280, margin: "0 auto", width: "100%" }}>
        {loading ? (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", paddingTop: 120 }}>
            <div
              style={{
                width: 28,
                height: 28,
                borderRadius: "50%",
                border: "2px solid var(--border)",
                borderTopColor: "var(--white)",
                animation: "spin 0.8s linear infinite",
              }}
            />
          </div>
        ) : jobs.length === 0 ? (
          <div
            style={{
              marginTop: 64,
              border: "1px solid var(--border)",
              borderRadius: 16,
              padding: "80px 40px",
              textAlign: "center",
            }}
          >
            <p style={{ fontSize: 16, color: "var(--fg-muted)" }}>
              No open positions right now. Check back soon!
            </p>
          </div>
        ) : filteredJobs.length === 0 ? (
          <div
            style={{
              marginTop: 64,
              border: "1px solid var(--border)",
              borderStyle: "dashed",
              borderRadius: 16,
              padding: "80px 40px",
              textAlign: "center",
            }}
          >
            <p style={{ fontSize: 16, color: "var(--fg-muted)", marginBottom: 16 }}>
              No jobs match your search criteria.
            </p>
            <button
              onClick={() => { setSearchQuery(""); setSelectedDept(""); setSelectedLoc(""); }}
              style={{
                background: "none",
                border: "none",
                color: "var(--white)",
                fontSize: 14,
                cursor: "pointer",
                fontFamily: "inherit",
                textDecoration: "underline",
                textUnderlineOffset: 3,
              }}
            >
              Clear all filters
            </button>
          </div>
        ) : (
          <motion.div
            variants={container}
            initial="hidden"
            animate="show"
            style={{ marginTop: 0 }}
          >
            {/* Header row */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr auto",
                alignItems: "center",
                padding: "28px 0 20px",
                borderBottom: "1px solid var(--border)",
              }}
            >
              <span style={{ fontSize: 12, fontWeight: 500, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--fg-muted)" }}>
                Role
              </span>
              <span style={{ fontSize: 12, fontWeight: 500, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--fg-muted)" }}>
                Location
              </span>
            </div>

            {/* Job rows (arkitekweb-style list) */}
            {filteredJobs.map((job, i) => (
              <motion.div
                key={job.id}
                variants={cardVariant}
                onClick={() => router.push(`/jobs/${job.id}`)}
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr auto",
                  alignItems: "center",
                  padding: "28px 0",
                  borderBottom: "1px solid var(--border)",
                  cursor: "pointer",
                  gap: 16,
                  transition: "opacity 0.2s",
                }}
                className="job-row-item"
                whileHover={{ x: 4 }}
                transition={{ duration: 0.2 }}
              >
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 8 }}>
                    <span className="dept-tag">{job.department}</span>
                  </div>
                  <h2
                    style={{
                      fontSize: "clamp(20px, 2.5vw, 28px)",
                      fontWeight: 600,
                      letterSpacing: "-0.025em",
                      color: "var(--white)",
                      marginBottom: 6,
                      lineHeight: 1.1,
                      fontFamily: '"Geist", ui-sans-serif, system-ui, sans-serif',
                    }}
                  >
                    {job.title}
                  </h2>
                  <p
                    style={{
                      fontSize: 13,
                      color: "var(--fg-muted)",
                      lineHeight: 1.5,
                      maxWidth: 500,
                    }}
                  >
                    {job.description.replace(/#{1,3} |[*_~`]/g, "").slice(0, 100)}
                    {job.description.length > 100 ? "…" : ""}
                  </p>
                </div>

                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 24,
                    flexShrink: 0,
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <MapPin style={{ width: 13, height: 13, color: "var(--fg-muted)" }} />
                    <span style={{ fontSize: 13, color: "var(--fg-muted)", whiteSpace: "nowrap" }}>
                      {job.location}
                    </span>
                  </div>
                  <div
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: "50%",
                      border: "1px solid var(--border)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      background: "var(--black-200)",
                      flexShrink: 0,
                      transition: "background 0.2s, border-color 0.2s",
                    }}
                  >
                    <ArrowRight style={{ width: 14, height: 14, color: "var(--fg-muted)" }} />
                  </div>
                </div>
              </motion.div>
            ))}
          </motion.div>
        )}
      </section>

      {/* ── Footer ── */}
      <footer className="site-footer">
        <div className="site-footer-inner">
          <p>© {new Date().getFullYear()} Careers Portal</p>
          <div className="site-footer-links">
            <a href="/">Home</a>
            <a href="/admin">Admin</a>
            <a
              href="https://www.linkedin.com/in/anandugirish/"
              target="_blank"
              rel="noopener noreferrer"
            >
              LinkedIn
            </a>
          </div>
        </div>
      </footer>
    </main>
  );
}
