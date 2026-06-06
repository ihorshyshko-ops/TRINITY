export default function Home() {
  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 12,
        padding: 24,
        background: "#E7DFD3",
        color: "#221D16",
        fontFamily: "system-ui, -apple-system, sans-serif",
        textAlign: "center",
      }}
    >
      <div
        style={{
          fontSize: 28,
          fontWeight: 700,
          letterSpacing: "-0.01em",
        }}
      >
        AI-планер дня
      </div>
      <p style={{ color: "#7B7163", fontSize: 15, maxWidth: 320, lineHeight: 1.5 }}>
        Скелет живий і задеплоєний. Далі — перенесення флоу: Думки → Inbox →
        Сьогодні.
      </p>
      <span style={{ fontSize: 13, color: "#A89E8E" }}>Фаза 0 ✓</span>
    </main>
  );
}
