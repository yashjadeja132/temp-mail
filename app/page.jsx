"use client";

import { useState, useEffect, useRef } from "react";
import {
  Box,
  Button,
  Card,
  CardContent,
  TextField,
  Chip,
  IconButton,
  Typography,
  Container,
  Paper,
  Stack,
  CircularProgress,
} from "@mui/material";
import {
  Mail,
  ContentCopy,
  Refresh,
  AccessTime,
  Delete,
  ArrowBack,
} from "@mui/icons-material";
import Cookies from "js-cookie";
import {
  getTempEmail,
  getTempEmailMessages,
  getTempEmailMessage,
  updateTempEmailSeenStatus,
} from "../actions";

const TOKEN_COOKIE_NAME = "temp_mail_token";
const EMAIL_COOKIE_NAME = "temp_mail_email";

export default function TempMailPage() {
  const [currentEmail, setCurrentEmail] = useState("");
  const [emails, setEmails] = useState([]);
  const [selectedEmail, setSelectedEmail] = useState(null);
  const [emailDetail, setEmailDetail] = useState(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [snackbar, setSnackbar] = useState({ open: false, message: "" });
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const pollingIntervalRef = useRef(null);

  // Initialize temp email on mount
  useEffect(() => {
    initializeTempEmail();
    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }
    };
  }, []);

  const initializeTempEmail = async () => {
    try {
      setLoading(true);

      // Check if we have a token in cookies
      const existingToken = Cookies.get(TOKEN_COOKIE_NAME);
      const existingEmail = Cookies.get(EMAIL_COOKIE_NAME);

      if (existingToken && existingEmail) {
        // Use existing email and token
        setCurrentEmail(existingEmail);
        await fetchEmails(existingToken);
        startPolling(existingToken);
      } else {
        // Create new temp email
        await createNewTempEmail();
      }
    } catch (error) {
      console.error("Error initializing temp email:", error);
      showMessage("Failed to initialize temp email");
    } finally {
      setLoading(false);
    }
  };

  const createNewTempEmail = async () => {
    try {
      setGenerating(true);
      const result = await getTempEmail();

      if (result.success) {
        // Store token in cookies for 1 day
        Cookies.set(TOKEN_COOKIE_NAME, result.token, { expires: 1 });
        Cookies.set(EMAIL_COOKIE_NAME, result.email, { expires: 1 });

        setCurrentEmail(result.email);
        await fetchEmails(result.token);
        startPolling(result.token);
        showMessage("New temporary email created successfully");
      } else {
        showMessage(result.error || "Failed to create temp email");
      }
    } catch (error) {
      console.error("Error creating temp email:", error);
      showMessage("Failed to create temp email");
    } finally {
      setGenerating(false);
    }
  };

  const fetchEmails = async (token) => {
    try {
      const result = await getTempEmailMessages(token);

      if (result.success) {
        // Transform API response to match our component format
        const transformedEmails = result.messages.map((msg) => ({
          id: msg.id,
          from: msg.from,
          subject: msg.subject || "(No subject)",
          preview: msg.intro || "",
          timestamp: new Date(msg.createdAt),
          read: msg.seen,
        }));

        setEmails(transformedEmails);
      } else {
        console.error("Error fetching emails:", result.error);
      }
    } catch (error) {
      console.error("Error fetching emails:", error);
    }
  };

  const startPolling = (token) => {
    // Clear any existing interval
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
    }

    // Poll for new emails every 5 seconds
    pollingIntervalRef.current = setInterval(() => {
      fetchEmails(token);
    }, 5000);
  };

  const generateNewEmail = async () => {
    // Clear existing polling
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
    }

    // Clear cookies
    Cookies.remove(TOKEN_COOKIE_NAME);
    Cookies.remove(EMAIL_COOKIE_NAME);

    // Create new temp email
    setEmails([]);
    await createNewTempEmail();
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(currentEmail);
    showMessage("Email address copied to clipboard");
  };

  const showMessage = (message) => {
    setSnackbar({ open: true, message });
    setTimeout(() => setSnackbar({ open: false, message: "" }), 3000);
  };

  const formatTime = (date) => {
    if (!date || !(date instanceof Date) || isNaN(date.getTime())) {
      return "Just now";
    }

    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) {
      return "Just now";
    } else if (diffMins < 60) {
      return `${diffMins}m ago`;
    } else if (diffMins < 1440) {
      return `${Math.floor(diffMins / 60)}h ago`;
    } else {
      return `${Math.floor(diffMins / 1440)}d ago`;
    }
  };

  const deleteEmail = (id, e) => {
    e.stopPropagation();
    setEmails(emails.filter((email) => email.id !== id));
    showMessage("Email deleted successfully");
  };

  const handleEmailClick = async (email) => {
    const token = Cookies.get(TOKEN_COOKIE_NAME);
    if (!token) {
      showMessage("No token found");
      return;
    }

    setSelectedEmail(email.id);
    setLoadingDetail(true);

    try {
      // Mark as read
      await updateTempEmailSeenStatus(token, email.id, true);

      // Fetch full email details
      const result = await getTempEmailMessage(token, email.id);

      if (result.success) {
        setEmailDetail(result);
        // Update local state to mark as read
        setEmails(
          emails.map((e) => (e.id === email.id ? { ...e, read: true } : e))
        );
      } else {
        showMessage(result.error || "Failed to load email");
      }
    } catch (error) {
      console.error("Error loading email:", error);
      showMessage("Failed to load email");
    } finally {
      setLoadingDetail(false);
    }
  };

  const handleBackClick = () => {
    setSelectedEmail(null);
    setEmailDetail(null);
  };

  const unreadCount = emails.filter((e) => !e.read).length;

  return (
    <Box
      sx={{
        minHeight: "100vh",
        background: "linear-gradient(135deg, #0a0e27 0%, #1a1f3a 100%)",
        py: 4,
      }}
    >
      <Container maxWidth="lg">
        {/* Header */}
        <Box sx={{ mb: 6, textAlign: "center" }}>
          <Box
            sx={{
              mb: 2,
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
            }}
          >
            <Paper
              elevation={0}
              sx={{
                p: 1.5,
                borderRadius: 2,
                background: "rgba(99, 102, 241, 0.15)",
                display: "inline-flex",
              }}
            >
              <Mail sx={{ fontSize: 40, color: "#6366f1" }} />
            </Paper>
          </Box>
          <Typography
            variant="h3"
            component="h1"
            sx={{
              mb: 1,
              fontWeight: 700,
              color: "#fff",
              letterSpacing: "-0.02em",
            }}
          >
            Temporary Email
          </Typography>
          <Typography
            variant="h6"
            sx={{ color: "rgba(255, 255, 255, 0.6)", fontWeight: 400 }}
          >
            Protect your privacy with disposable email addresses
          </Typography>
        </Box>

        {/* Email Display Card */}
        <Card
          elevation={3}
          sx={{
            mb: 4,
            background: "rgba(255, 255, 255, 0.05)",
            backdropFilter: "blur(10px)",
            border: "1px solid rgba(255, 255, 255, 0.1)",
          }}
        >
          <CardContent sx={{ p: 3 }}>
            <Box
              sx={{
                mb: 2,
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <Stack direction="row" spacing={1} alignItems="center">
                <Chip
                  label="Active"
                  size="small"
                  sx={{
                    background: "rgba(34, 197, 94, 0.15)",
                    color: "#22c55e",
                    fontWeight: 600,
                    border: "1px solid rgba(34, 197, 94, 0.3)",
                  }}
                />
                <Typography
                  variant="body2"
                  sx={{ color: "rgba(255, 255, 255, 0.5)" }}
                >
                  Your temporary email
                </Typography>
              </Stack>
              <Button
                variant="outlined"
                startIcon={
                  generating ? (
                    <CircularProgress size={16} color="inherit" />
                  ) : (
                    <Refresh />
                  )
                }
                onClick={generateNewEmail}
                size="small"
                disabled={generating || loading}
                sx={{
                  borderColor: "rgba(255, 255, 255, 0.2)",
                  color: "#fff",
                  "&:hover": {
                    borderColor: "rgba(255, 255, 255, 0.4)",
                    background: "rgba(255, 255, 255, 0.05)",
                  },
                }}
              >
                New Email
              </Button>
            </Box>

            <Stack direction="row" spacing={1.5}>
              <TextField
                value={loading ? "Loading..." : currentEmail || "No email"}
                fullWidth
                disabled={loading}
                InputProps={{
                  readOnly: true,
                  sx: {
                    fontFamily: "monospace",
                    fontSize: "1rem",
                    color: "#fff",
                    background: "rgba(0, 0, 0, 0.2)",
                    "& fieldset": { borderColor: "rgba(255, 255, 255, 0.1)" },
                  },
                }}
              />
              <IconButton
                onClick={copyToClipboard}
                disabled={!currentEmail || loading}
                sx={{
                  background: "rgba(99, 102, 241, 0.2)",
                  color: "#6366f1",
                  "&:hover": { background: "rgba(99, 102, 241, 0.3)" },
                }}
              >
                <ContentCopy />
              </IconButton>
            </Stack>
          </CardContent>
        </Card>

        {/* Inbox Header */}
        <Box
          sx={{
            mb: 3,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <Box>
            <Typography
              variant="h5"
              sx={{ fontWeight: 600, color: "#fff", mb: 0.5 }}
            >
              {selectedEmail ? "Email Detail" : "Inbox"}
            </Typography>
            <Typography
              variant="body2"
              sx={{ color: "rgba(255, 255, 255, 0.5)" }}
            >
              {selectedEmail
                ? "Viewing email"
                : `${unreadCount} unread messages`}
            </Typography>
          </Box>
          {selectedEmail && (
            <Button
              startIcon={<ArrowBack />}
              onClick={handleBackClick}
              sx={{
                color: "#fff",
                borderColor: "rgba(255, 255, 255, 0.2)",
                "&:hover": {
                  borderColor: "rgba(255, 255, 255, 0.4)",
                  background: "rgba(255, 255, 255, 0.05)",
                },
              }}
              variant="outlined"
            >
              Back to Inbox
            </Button>
          )}
        </Box>

        {/* Main Content Area */}
        {!selectedEmail ? (
          /* Email List - Visible when no email is selected */
          <Stack spacing={2}>
            {emails.length === 0 ? (
              <Card
                elevation={2}
                sx={{
                  background: "rgba(255, 255, 255, 0.03)",
                  border: "1px solid rgba(255, 255, 255, 0.08)",
                  py: 8,
                }}
              >
                <CardContent>
                  <Box sx={{ textAlign: "center" }}>
                    <Mail
                      sx={{
                        fontSize: 60,
                        color: "rgba(255, 255, 255, 0.2)",
                        mb: 2,
                      }}
                    />
                    <Typography variant="h6" sx={{ color: "#fff", mb: 1 }}>
                      No emails yet
                    </Typography>
                    <Typography
                      variant="body2"
                      sx={{ color: "rgba(255, 255, 255, 0.5)" }}
                    >
                      Emails sent to {currentEmail} will appear here
                    </Typography>
                  </Box>
                </CardContent>
              </Card>
            ) : (
              emails.map((email) => (
                <Card
                  key={email.id}
                  elevation={2}
                  sx={{
                    background: email.read
                      ? "rgba(255, 255, 255, 0.03)"
                      : "rgba(255, 255, 255, 0.08)",
                    border: "1px solid rgba(255, 255, 255, 0.1)",
                    cursor: "pointer",
                    transition: "all 0.2s",
                    "&:hover": {
                      borderColor: "rgba(255, 255, 255, 0.2)",
                      boxShadow: "0 4px 12px rgba(0, 0, 0, 0.3)",
                      "& .delete-btn": {
                        opacity: 1,
                      },
                    },
                  }}
                  onClick={() => handleEmailClick(email)}
                >
                  <CardContent sx={{ p: 2.5 }}>
                    <Box
                      sx={{
                        display: "flex",
                        justifyContent: "space-between",
                        gap: 2,
                      }}
                    >
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Stack
                          direction="row"
                          spacing={1}
                          alignItems="center"
                          sx={{ mb: 0.5 }}
                        >
                          <Typography
                            variant="body2"
                            sx={{
                              color: "#fff",
                              fontWeight: 500,
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {email.from}
                          </Typography>
                          {!email.read && (
                            <Chip
                              label="New"
                              size="small"
                              sx={{
                                height: 20,
                                background: "#6366f1",
                                color: "#fff",
                                fontSize: "0.7rem",
                                fontWeight: 600,
                              }}
                            />
                          )}
                        </Stack>
                        <Typography
                          variant="body1"
                          sx={{
                            color: email.read
                              ? "rgba(255, 255, 255, 0.5)"
                              : "#fff",
                            fontWeight: email.read ? 400 : 600,
                            mb: 0.5,
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {email.subject}
                        </Typography>
                        <Typography
                          variant="body2"
                          sx={{
                            color: "rgba(255, 255, 255, 0.4)",
                            display: "-webkit-box",
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: "vertical",
                            overflow: "hidden",
                          }}
                        >
                          {email.preview}
                        </Typography>
                      </Box>
                      <Box
                        sx={{
                          display: "flex",
                          flexDirection: "column",
                          alignItems: "flex-end",
                          gap: 1,
                        }}
                      >
                        <Stack
                          direction="row"
                          spacing={0.5}
                          alignItems="center"
                        >
                          <AccessTime
                            sx={{
                              fontSize: 14,
                              color: "rgba(255, 255, 255, 0.4)",
                            }}
                          />
                          <Typography
                            variant="caption"
                            sx={{ color: "rgba(255, 255, 255, 0.4)" }}
                          >
                            {formatTime(email.timestamp)}
                          </Typography>
                        </Stack>
                        <IconButton
                          className="delete-btn"
                          size="small"
                          onClick={(e) => deleteEmail(email.id, e)}
                          sx={{
                            opacity: 0,
                            transition: "opacity 0.2s",
                            color: "rgba(255, 255, 255, 0.5)",
                            "&:hover": {
                              color: "#ef4444",
                              background: "rgba(239, 68, 68, 0.1)",
                            },
                          }}
                        >
                          <Delete fontSize="small" />
                        </IconButton>
                      </Box>
                    </Box>
                  </CardContent>
                </Card>
              ))
            )}
          </Stack>
        ) : (
          /* Email Detail View - Visible when email is selected */
          <Card
            elevation={3}
            sx={{
              background: "rgba(255, 255, 255, 0.05)",
              backdropFilter: "blur(10px)",
              border: "1px solid rgba(255, 255, 255, 0.1)",
            }}
          >
            <CardContent sx={{ p: 3 }}>
              {loadingDetail ? (
                <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
                  <CircularProgress />
                </Box>
              ) : emailDetail ? (
                <>
                  <Box sx={{ mb: 3 }}>
                    <Typography
                      variant="h6"
                      sx={{
                        color: "#fff",
                        fontWeight: 600,
                        mb: 2,
                      }}
                    >
                      {emailDetail.subject || "(No subject)"}
                    </Typography>
                    <Stack spacing={1.5}>
                      <Box>
                        <Typography
                          variant="caption"
                          sx={{
                            color: "rgba(255, 255, 255, 0.5)",
                            display: "block",
                            mb: 0.5,
                          }}
                        >
                          From:
                        </Typography>
                        <Typography variant="body2" sx={{ color: "#fff" }}>
                          {emailDetail.from}
                        </Typography>
                      </Box>
                    </Stack>
                  </Box>
                  <Box
                    sx={{
                      mt: 3,
                      pt: 3,
                      borderTop: "1px solid rgba(255, 255, 255, 0.1)",
                    }}
                  >
                    {emailDetail.html ? (
                      <Box
                        sx={{
                          color: "#333",
                          backgroundColor: "#fff",
                          borderRadius: 2,
                          "& body": {
                            color: "#333",
                            backgroundColor: "#fff",
                          },
                        }}
                        dangerouslySetInnerHTML={{ __html: emailDetail.html }}
                      />
                    ) : (
                      <Typography
                        variant="body2"
                        sx={{
                          color: "#333",
                          whiteSpace: "pre-wrap",
                          wordBreak: "break-word",
                          lineHeight: 1.6,
                          "& body": {
                            color: "#333",
                            backgroundColor: "#fff",
                          },
                        }}
                      >
                        {emailDetail.text || "No content"}
                      </Typography>
                    )}
                  </Box>
                </>
              ) : (
                <Box sx={{ textAlign: "center", py: 4 }}>
                  <Typography
                    variant="body2"
                    sx={{ color: "rgba(255, 255, 255, 0.5)" }}
                  >
                    Failed to load email
                  </Typography>
                </Box>
              )}
            </CardContent>
          </Card>
        )}

        {/* Footer */}
        <Box
          sx={{
            mt: 8,
            pt: 4,
            borderTop: "1px solid rgba(255, 255, 255, 0.1)",
            textAlign: "center",
          }}
        >
          <Typography
            variant="body2"
            sx={{ color: "rgba(255, 255, 255, 0.4)" }}
          >
            All emails are automatically deleted after 24 hours for your privacy
          </Typography>
        </Box>

        {/* Snackbar */}
        {snackbar.open && (
          <Box
            sx={{
              position: "fixed",
              bottom: 24,
              left: "50%",
              transform: "translateX(-50%)",
              background: "rgba(0, 0, 0, 0.9)",
              color: "#fff",
              px: 3,
              py: 1.5,
              borderRadius: 2,
              boxShadow: "0 4px 12px rgba(0, 0, 0, 0.4)",
              zIndex: 9999,
            }}
          >
            <Typography variant="body2">{snackbar.message}</Typography>
          </Box>
        )}
      </Container>
    </Box>
  );
}
