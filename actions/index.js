import axios from "axios";

const generateUserName = () => {
  const randomString = Math.random().toString(36).substring(2, 10);
  return randomString;
};

const generatePassword = () => {
  const randomString = Math.random().toString(36).substring(2, 10);
  return `${generateUserName()}@${randomString}`;
};

export const getTempEmail = async () => {
  try {
    // 1. Get domain
    const domainRes = await axios.get("https://api.mail.tm/domains");
    const domain = domainRes.data["hydra:member"][0].domain;

    // 2. Generate username and password
    const username = generateUserName();
    const password = generatePassword();

    // 3. Create email
    const email = `${username}@${domain}`;

    await axios.post("https://api.mail.tm/accounts", {
      address: email,
      password: password,
    });

    // 4. Login
    const tokenRes = await axios.post("https://api.mail.tm/token", {
      address: email,
      password: password,
    });

    return {
      success: true,
      email,
      token: tokenRes.data.token,
    };
  } catch (err) {
    console.error(err.response?.data || err.message);
    return { success: false, error: "Temp mail failed" };
  }
};

export const getTempEmailMessages = async (token) => {
  try {
    const response = await axios.get("https://api.mail.tm/messages", {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    const messages = response.data["hydra:member"];

    return {
      success: true,
      count: messages.length,
      messages: messages.map((msg) => ({
        id: msg.id,
        from: msg.from.address,
        subject: msg.subject,
        intro: msg.intro,
        seen: msg.seen,
        createdAt: msg.createdAt,
      })),
    };
  } catch (err) {
    console.error(err.response?.data || err.message);
    return { success: false, error: "Failed to fetch emails" };
  }
};

export const extractOTP = (text) => {
  try {
    // supports 4–8 digit OTP
    const match = text.match(/\b\d{4,8}\b/);
    return { success: true, otp: match ? match[0] : null };
  } catch {
    return { success: false, error: "Failed to extract OTP" };
  }
};

export const extractVerificationLink = (html, text) => {
  try {
    const source = html || text || "";
    const match = source.match(/(https?:\/\/[^\s"'<>]+)/i);
    return { success: true, verificationLink: match ? match[0] : null };
  } catch {
    return { success: false, error: "Failed to extract verification link" };
  }
};

export const getTempEmailMessage = async (token, id) => {
  try {
    const response = await axios.get(`https://api.mail.tm/messages/${id}`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    const text = response.data.text || "";
    const html = response.data.html?.join("") || "";

    const otp = extractOTP(text);
    const verificationLink = extractVerificationLink(html, text);

    return {
      success: true,
      id,
      from: response.data.from.address,
      subject: response.data.subject,
      otp,
      verificationLink,
      text,
      html,
    };
  } catch {
    return { success: false, error: "Read failed" };
  }
};

export const deleteTempEmail = async (token) => {
  try {
    await axios.delete("https://api.mail.tm/me", {
      headers: { Authorization: `Bearer ${token}` },
    });

    return { success: true, message: "Temp email deleted" };
  } catch {
    return { success: false, error: "Delete failed" };
  }
};

export const updateTempEmailSeenStatus = async (token, id, seen = true) => {
  try {
    const response = await axios.patch(
      `https://api.mail.tm/messages/${id}`,
      { seen },
      {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/merge-patch+json",
        },
      }
    );

    return {
      success: true,
      id,
      seen: response.data.seen,
    };
  } catch (err) {
    console.error(err.response?.data || err.message);
    return { success: false, error: "Failed to update seen status" };
  }
};
