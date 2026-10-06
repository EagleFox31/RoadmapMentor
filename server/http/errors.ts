

export const handleError = (res: any, error: any) => {
  if (error?.name === "ZodError") {
    return res.status(400).json({
      error: "Validation failed",
      issues: error.issues,
    });
  }
  console.error("API Error:", error);
  res.status(500).json({ error: error.message || "Internal server error" });
};
