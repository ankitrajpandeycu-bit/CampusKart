
import { useState, useEffect } from "react";
import axios from "axios";
import {
  Search, MapPin, Heart, MessageCircle, Plus, User,
  BookOpen, Laptop, Bike, Shirt, Grid2X2, X, LogOut,
  Trash2, Inbox, Send, ArrowLeft, CheckCheck,
  ImagePlus, Eye
} from "lucide-react";
import "./App.css";

const API = "http://localhost:5000/api/products";
const AUTH_API = "http://localhost:5000/api/auth";
const MESSAGE_API = "http://localhost:5000/api/messages";
const SERVER_URL = "http://localhost:5000";

const categories = [
  { name: "All", icon: Grid2X2 },
  { name: "Books", icon: BookOpen },
  { name: "Electronics", icon: Laptop },
  { name: "Vehicles", icon: Bike },
  { name: "Fashion", icon: Shirt },
  { name: "Furniture", icon: Grid2X2 }
];

const getImageUrl = (image) => {
  if (!image) return "https://placehold.co/600x400?text=CampusKart";
  if (image.startsWith("http")) return image;
  return `${SERVER_URL}${image.startsWith("/") ? "" : "/"}${image}`;
};

function App() {
  const [products, setProducts] = useState([]);
  const [myListings, setMyListings] = useState([]);
  const [showMyListings, setShowMyListings] = useState(false);
  const [deletingId, setDeletingId] = useState("");
  const [deleteTarget, setDeleteTarget] = useState(null);

  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All");
  const [favorites, setFavorites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const [showAuth, setShowAuth] = useState(false);
  const [authMode, setAuthMode] = useState("login");
  const [authLoading, setAuthLoading] = useState(false);
  const [authMessage, setAuthMessage] = useState("");

  const [user, setUser] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("campuskart_user")) || null;
    } catch {
      return null;
    }
  });

  const [authForm, setAuthForm] = useState({
    name: "",
    email: "",
    password: ""
  });

  const [form, setForm] = useState({
    title: "",
    description: "",
    price: "",
    category: "Books",
    condition: "Good",
    image: "",
    location: "College Campus"
  });

  // IMAGE UPLOAD STATES
  const [selectedImages, setSelectedImages] = useState([]);
  const [imagePreviews, setImagePreviews] = useState([]);
  const [imageError, setImageError] = useState("");

  // Messaging states
  const [messageTarget, setMessageTarget] = useState(null);
  const [messageText, setMessageText] = useState("");
  const [sendingMessage, setSendingMessage] = useState(false);
  const [messageStatus, setMessageStatus] = useState("");

  const [showMessages, setShowMessages] = useState(false);
  const [messageTab, setMessageTab] = useState("inbox");
  const [inboxMessages, setInboxMessages] = useState([]);
  const [sentMessages, setSentMessages] = useState([]);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  // Conversation states
  const [activeConversation, setActiveConversation] = useState(null);
  const [conversationMessages, setConversationMessages] = useState([]);
  const [conversationLoading, setConversationLoading] = useState(false);
  const [conversationText, setConversationText] = useState("");
  const [sendingReply, setSendingReply] = useState(false);
  const [conversationError, setConversationError] = useState("");

  const getToken = () => localStorage.getItem("campuskart_token");

  const authHeaders = () => ({
    headers: {
      Authorization: `Bearer ${getToken()}`
    }
  });

  // IMAGE PREVIEW CLEANUP
  const clearSelectedImages = () => {
    imagePreviews.forEach((url) => URL.revokeObjectURL(url));
    setSelectedImages([]);
    setImagePreviews([]);
    setImageError("");
  };

  // SELECT PRODUCT IMAGES
  const handleImageChange = (e) => {
    const files = Array.from(e.target.files || []);
    setImageError("");

    if (files.length === 0) return;

    const validFiles = [];
    const errors = [];

    files.forEach((file) => {
      if (!file.type.startsWith("image/")) {
        errors.push(`${file.name} is not an image.`);
        return;
      }

      if (file.size > 5 * 1024 * 1024) {
        errors.push(`${file.name} exceeds the 5 MB limit.`);
        return;
      }

      validFiles.push(file);
    });

    const remainingSlots = 5 - selectedImages.length;
    const acceptedFiles = validFiles.slice(0, remainingSlots);

    if (validFiles.length > remainingSlots) {
      errors.push("You can upload a maximum of 5 images.");
    }

    if (acceptedFiles.length > 0) {
      const newPreviews = acceptedFiles.map((file) =>
        URL.createObjectURL(file)
      );

      setSelectedImages((previous) => [
        ...previous,
        ...acceptedFiles
      ]);

      setImagePreviews((previous) => [
        ...previous,
        ...newPreviews
      ]);
    }

    if (errors.length > 0) {
      setImageError(errors.join(" "));
    }

    e.target.value = "";
  };

  // REMOVE SELECTED IMAGE
  const removeSelectedImage = (index) => {
    const previewUrl = imagePreviews[index];

    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }

    setSelectedImages((previous) =>
      previous.filter((_, i) => i !== index)
    );

    setImagePreviews((previous) =>
      previous.filter((_, i) => i !== index)
    );
  };

  // RESET PRODUCT FORM
  const resetProductForm = () => {
    imagePreviews.forEach((url) => URL.revokeObjectURL(url));

    setSelectedImages([]);
    setImagePreviews([]);
    setImageError("");

    setForm({
      title: "",
      description: "",
      price: "",
      category: "Books",
      condition: "Good",
      image: "",
      location: "College Campus"
    });
  };

  // Fetch unread notification count
  const fetchUnreadCount = async () => {
    if (!getToken()) {
      setUnreadCount(0);
      return;
    }

    try {
      const response = await axios.get(
        `${MESSAGE_API}/unread-count`,
        authHeaders()
      );

      setUnreadCount(response.data.unreadCount || 0);
    } catch (err) {
      console.error("Unread count error:", err);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, []);

  useEffect(() => {
    if (user) {
      fetchUnreadCount();
    } else {
      setUnreadCount(0);
    }
  }, [user]);

  // Fetch all products
  const fetchProducts = async () => {
    try {
      const response = await axios.get(API);
      setProducts(response.data.products || []);
      setError("");
    } catch (err) {
      setError("Unable to load products. Check your backend server.");
    } finally {
      setLoading(false);
    }
  };

  // Product form handler
  const handleChange = (e) => {
    setForm({
      ...form,
      [e.target.name]: e.target.value
    });
  };

  // Authentication form handler
  const handleAuthChange = (e) => {
    setAuthForm({
      ...authForm,
      [e.target.name]: e.target.value
    });
  };

  const openAuth = (mode = "login") => {
    setAuthMode(mode);
    setAuthMessage("");
    setAuthForm({
      name: "",
      email: "",
      password: ""
    });
    setShowAuth(true);
  };

  // Login and Register
  const handleAuthSubmit = async (e) => {
    e.preventDefault();
    setAuthLoading(true);
    setAuthMessage("");

    try {
      const endpoint = authMode === "register"
        ? "/register"
        : "/login";

      const response = await axios.post(
        `${AUTH_API}${endpoint}`,
        authForm
      );

      const { token, user: loggedInUser } = response.data;

      localStorage.setItem("campuskart_token", token);
      localStorage.setItem(
        "campuskart_user",
        JSON.stringify(loggedInUser)
      );

      setUser(loggedInUser);
      setShowAuth(false);

      setAuthForm({
        name: "",
        email: "",
        password: ""
      });

      setMessage(response.data.message);
    } catch (err) {
      setAuthMessage(
        err.response?.data?.message ||
        "Authentication failed. Please try again."
      );
    } finally {
      setAuthLoading(false);
    }
  };

  // Logout
  const handleLogout = () => {
    localStorage.removeItem("campuskart_token");
    localStorage.removeItem("campuskart_user");

    setUser(null);
    setMessage("You have logged out successfully.");
    setShowForm(false);
    setShowMyListings(false);
    setShowMessages(false);
    setMyListings([]);
    setInboxMessages([]);
    setSentMessages([]);
    setUnreadCount(0);
    setDeleteTarget(null);
    setMessageTarget(null);
    setActiveConversation(null);
    setConversationMessages([]);
  };

  // Open sell form
  const openSellForm = () => {
    if (!user) {
      openAuth("login");
      setAuthMessage("Please login to sell a product.");
      return;
    }

    setMessage("");
    setImageError("");
    setShowForm(true);
  };

  // ADD PRODUCT WITH MULTIPLE IMAGES
  const handleSubmit = async (e) => {
    e.preventDefault();

    const token = getToken();

    if (!token) {
      setShowForm(false);
      openAuth("login");
      return;
    }

    if (selectedImages.length > 5) {
      setImageError("You can upload a maximum of 5 images.");
      return;
    }

    setSaving(true);
    setMessage("");
    setImageError("");

    try {
      const formData = new FormData();

      formData.append("title", form.title);
      formData.append("description", form.description);
      formData.append("price", String(Number(form.price)));
      formData.append("category", form.category);
      formData.append("condition", form.condition);
      formData.append("location", form.location);
      formData.append("image", form.image || "");

      selectedImages.forEach((file) => {
        formData.append("images", file);
      });

      const response = await axios.post(
        API,
        formData,
        {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      );

      setProducts((previous) => [
        response.data.product,
        ...previous
      ]);

      resetProductForm();
      setShowForm(false);
      setMessage("Product added successfully!");
    } catch (err) {
      setMessage(
        err.response?.data?.message || "Unable to add product."
      );
    } finally {
      setSaving(false);
    }
  };

  // Fetch My Listings
  const fetchMyListings = async () => {
    if (!getToken()) {
      openAuth("login");
      setAuthMessage("Please login to view your listings.");
      return;
    }

    try {
      const response = await axios.get(
        `${API}/my-listings`,
        authHeaders()
      );

      setMyListings(response.data.products || []);
      setShowMyListings(true);
      setShowMessages(false);
      setActiveConversation(null);
      setMessage("");
    } catch (err) {
      setMessage(
        err.response?.data?.message ||
        "Unable to load your listings."
      );
    }
  };

  // Delete product
  const handleDeleteProduct = (product) => {
    setDeleteTarget(product);
  };

  const confirmDeleteProduct = async () => {
    if (!deleteTarget) return;

    const productId = deleteTarget._id;
    setDeletingId(productId);

    try {
      await axios.delete(
        `${API}/${productId}`,
        authHeaders()
      );

      setMyListings((previous) =>
        previous.filter((product) => product._id !== productId)
      );

      setProducts((previous) =>
        previous.filter((product) => product._id !== productId)
      );

      setMessage("Product deleted successfully!");
      setDeleteTarget(null);
    } catch (err) {
      setMessage(
        err.response?.data?.message ||
        "Unable to delete product."
      );
    } finally {
      setDeletingId("");
    }
  };

  // Open Contact Seller modal
  const openContactSeller = (product) => {
    if (!user) {
      openAuth("login");
      setAuthMessage("Please login to contact the seller.");
      return;
    }

    if (!product.seller) {
      setMessage("Seller information is unavailable for this product.");
      return;
    }

    const sellerId = typeof product.seller === "object"
      ? product.seller._id
      : product.seller;

    if (sellerId === user._id || sellerId === user.id) {
      setMessage("This is your own product.");
      return;
    }

    setMessageTarget(product);
    setMessageText("");
    setMessageStatus("");
  };

  // Send first message to seller
  const handleSendMessage = async (e) => {
    e.preventDefault();

    if (!messageTarget || !messageText.trim()) {
      setMessageStatus("Please write a message first.");
      return;
    }

    setSendingMessage(true);
    setMessageStatus("");

    try {
      const response = await axios.post(
        MESSAGE_API,
        {
          productId: messageTarget._id,
          text: messageText.trim()
        },
        authHeaders()
      );

      setMessageStatus(
        response.data.message || "Message sent successfully!"
      );

      setMessageText("");
      fetchUnreadCount();
    } catch (err) {
      setMessageStatus(
        err.response?.data?.message ||
        "Unable to send message."
      );
    } finally {
      setSendingMessage(false);
    }
  };

  // Fetch Inbox and Sent messages
  const fetchMessages = async (tab = "inbox") => {
    if (!getToken()) {
      openAuth("login");
      setAuthMessage("Please login to view your messages.");
      return;
    }

    setMessagesLoading(true);
    setMessageTab(tab);
    setShowMessages(true);
    setShowMyListings(false);
    setActiveConversation(null);
    setMessage("");

    try {
      const [inboxResponse, sentResponse] = await Promise.all([
        axios.get(`${MESSAGE_API}/inbox`, authHeaders()),
        axios.get(`${MESSAGE_API}/sent`, authHeaders())
      ]);

      setInboxMessages(inboxResponse.data.messages || []);
      setSentMessages(sentResponse.data.messages || []);
      setUnreadCount(inboxResponse.data.unreadCount || 0);
    } catch (err) {
      setMessage(
        err.response?.data?.message ||
        "Unable to load messages."
      );
    } finally {
      setMessagesLoading(false);
    }
  };

  // Open a conversation
  const openConversation = async (item) => {
    const otherUser = messageTab === "inbox"
      ? item.sender
      : item.receiver;

    const otherUserId = otherUser?._id;
    const productId = item.product?._id;

    if (!otherUserId || !productId) {
      setConversationError("Conversation information is unavailable.");
      return;
    }

    setActiveConversation({
      userId: otherUserId,
      userName: otherUser?.name || "Student",
      productId,
      product: item.product,
      tab: messageTab
    });

    setConversationLoading(true);
    setConversationError("");
    setConversationMessages([]);
    setConversationText("");

    try {
      const response = await axios.get(
        `${MESSAGE_API}/conversation/${otherUserId}/${productId}`,
        authHeaders()
      );

      setConversationMessages(response.data.messages || []);

      const [inboxResponse, sentResponse] = await Promise.all([
        axios.get(`${MESSAGE_API}/inbox`, authHeaders()),
        axios.get(`${MESSAGE_API}/sent`, authHeaders())
      ]);

      setInboxMessages(inboxResponse.data.messages || []);
      setSentMessages(sentResponse.data.messages || []);
      setUnreadCount(inboxResponse.data.unreadCount || 0);
    } catch (err) {
      setConversationError(
        err.response?.data?.message ||
        "Unable to open this conversation."
      );
    } finally {
      setConversationLoading(false);
    }
  };

  // Send reply in conversation
  const handleSendReply = async (e) => {
    e.preventDefault();

    if (!activeConversation || !conversationText.trim()) return;

    setSendingReply(true);
    setConversationError("");

    try {
      const response = await axios.post(
        `${MESSAGE_API}/reply`,
        {
          productId: activeConversation.productId,
          receiverId: activeConversation.userId,
          text: conversationText.trim()
        },
        authHeaders()
      );

      setConversationMessages((previous) => [
        ...previous,
        response.data.data
      ]);

      setConversationText("");
      fetchUnreadCount();

      const [inboxResponse, sentResponse] = await Promise.all([
        axios.get(`${MESSAGE_API}/inbox`, authHeaders()),
        axios.get(`${MESSAGE_API}/sent`, authHeaders())
      ]);

      setInboxMessages(inboxResponse.data.messages || []);
      setSentMessages(sentResponse.data.messages || []);
      setUnreadCount(inboxResponse.data.unreadCount || 0);
    } catch (err) {
      setConversationError(
        err.response?.data?.message ||
        "Unable to send reply."
      );
    } finally {
      setSendingReply(false);
    }
  };

  // Search and category filter
  const filteredProducts = products.filter((product) => {
    const matchesSearch = product.title
      ?.toLowerCase()
      .includes(search.toLowerCase());

    const matchesCategory =
      category === "All" ||
      product.category === category;

    return matchesSearch && matchesCategory;
  });

  // Wishlist
  const toggleFavorite = (id) => {
    setFavorites((previous) =>
      previous.includes(id)
        ? previous.filter((item) => item !== id)
        : [...previous, id]
    );
  };

  const formatDate = (date) => {
    return new Date(date).toLocaleString("en-IN", {
      dateStyle: "medium",
      timeStyle: "short"
    });
  };

  return (
    <div className="app">

      {/* NAVBAR */}
      <header className="navbar">
        <div className="nav-container">

          <a
            href="/"
            className="logo"
            onClick={() => {
              setShowMyListings(false);
              setShowMessages(false);
              setActiveConversation(null);
            }}
          >
            Campus<span>Kart</span>
            <small>STUDENT MARKETPLACE</small>
          </a>

          <div className="location">
            <MapPin size={18} />
            <span>College Campus</span>
          </div>

          <div className="nav-search">
            <Search size={20} />
            <input
              placeholder="Search books, laptops, cycles..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          {user ? (
            <div style={{
              display: "flex",
              alignItems: "center",
              gap: "12px",
              flexWrap: "wrap"
            }}>

              <button className="login-btn" onClick={fetchMyListings}>
                My Listings
              </button>

              <button
                className="login-btn"
                onClick={() => fetchMessages("inbox")}
                style={{ position: "relative" }}
              >
                <Inbox size={17} /> Inbox

                {unreadCount > 0 && (
                  <span style={{
                    background: "#ff7139",
                    color: "#fff",
                    borderRadius: "20px",
                    fontSize: "11px",
                    fontWeight: "700",
                    minWidth: "19px",
                    height: "19px",
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    padding: "0 5px",
                    marginLeft: "4px"
                  }}>
                    {unreadCount > 99 ? "99+" : unreadCount}
                  </span>
                )}
              </button>

              <span style={{
                color: "#ffffff",
                fontWeight: "600"
              }}>
                <User
                  size={17}
                  style={{
                    verticalAlign: "middle",
                    marginRight: "5px"
                  }}
                />
                {user.name}
              </span>

              <button className="login-btn" onClick={handleLogout}>
                <LogOut size={17} /> Logout
              </button>

            </div>
          ) : (
            <button
              className="login-btn"
              onClick={() => openAuth("login")}
            >
              <User size={18} /> Login
            </button>
          )}

          <button className="sell-btn" onClick={openSellForm}>
            <Plus size={19} /> SELL
          </button>

        </div>
      </header>

      <main>

        {/* MESSAGES PAGE */}
        {showMessages ? (

          <section
            className="products-section"
            style={{ minHeight: "65vh" }}
          >

            {!activeConversation ? (
              <>
                <div className="section-heading">
                  <div>
                    <span className="eyebrow">
                      YOUR CAMPUSKART ACCOUNT
                    </span>
                    <h2>Messages</h2>
                    <p>Connect with buyers and sellers on CampusKart.</p>
                  </div>

                  <button
                    className="hero-btn"
                    onClick={() => {
                      setShowMessages(false);
                      setMessage("");
                    }}
                  >
                    <ArrowLeft size={17} /> Marketplace
                  </button>
                </div>

                <div style={{
                  display: "flex",
                  gap: "12px",
                  flexWrap: "wrap",
                  margin: "25px 0"
                }}>
                  <button
                    className="login-btn"
                    onClick={() => fetchMessages("inbox")}
                    style={{
                      background: messageTab === "inbox"
                        ? "#ff7139"
                        : undefined
                    }}
                  >
                    <Inbox size={17} />
                    Inbox ({inboxMessages.length})
                    {unreadCount > 0 && ` · ${unreadCount} unread`}
                  </button>

                  <button
                    className="login-btn"
                    onClick={() => fetchMessages("sent")}
                    style={{
                      background: messageTab === "sent"
                        ? "#ff7139"
                        : undefined
                    }}
                  >
                    <Send size={17} />
                    Sent Messages ({sentMessages.length})
                  </button>
                </div>

                {messagesLoading ? (
                  <p>Loading messages...</p>
                ) : (
                  <div style={{
                    display: "grid",
                    gap: "16px"
                  }}>

                    {(messageTab === "inbox"
                      ? inboxMessages
                      : sentMessages
                    ).map((item) => (

                      <article
                        className="product-card"
                        key={item._id}
                        onClick={() => openConversation(item)}
                        style={{
                          padding: "22px",
                          cursor: "pointer",
                          border: messageTab === "inbox" && !item.isRead
                            ? "1px solid #ff7139"
                            : undefined
                        }}
                      >

                        <div style={{
                          display: "flex",
                          justifyContent: "space-between",
                          gap: "15px",
                          flexWrap: "wrap"
                        }}>
                          <div>
                            <span className="product-category">
                              {messageTab === "inbox"
                                ? "MESSAGE FROM BUYER"
                                : "MESSAGE TO SELLER"}
                            </span>

                            <h3 style={{ margin: "10px 0" }}>
                              {item.product?.title || "Product"}
                            </h3>
                          </div>

                          <div style={{
                            display: "flex",
                            flexDirection: "column",
                            alignItems: "flex-end",
                            gap: "8px"
                          }}>
                            <span style={{
                              color: "#aaa",
                              fontSize: "13px"
                            }}>
                              {formatDate(item.createdAt)}
                            </span>

                            {messageTab === "inbox" && (
                              <span style={{
                                color: item.isRead ? "#aaa" : "#ff9a69",
                                fontSize: "12px",
                                fontWeight: "700"
                              }}>
                                {item.isRead ? (
                                  <><CheckCheck size={14} style={{ verticalAlign: "middle" }} /> READ</>
                                ) : (
                                  "● UNREAD"
                                )}
                              </span>
                            )}
                          </div>
                        </div>

                        <p style={{
                          color: "#ddd",
                          lineHeight: "1.7",
                          margin: "10px 0"
                        }}>
                          {item.text}
                        </p>

                        <div style={{
                          color: "#aaa",
                          fontSize: "14px",
                          display: "flex",
                          gap: "7px",
                          flexWrap: "wrap"
                        }}>
                          <User size={15} />

                          {messageTab === "inbox"
                            ? `Buyer: ${item.sender?.name || "Student"}`
                            : `Seller: ${item.receiver?.name || "Student"}`}
                        </div>

                        {item.product?.price !== undefined && (
                          <p style={{
                            color: "#ff9a69",
                            marginTop: "8px"
                          }}>
                            Product Price: ₹
                            {Number(item.product.price).toLocaleString("en-IN")}
                          </p>
                        )}

                        <p style={{
                          color: "#ff9a69",
                          fontSize: "13px",
                          marginTop: "12px"
                        }}>
                          Open Conversation →
                        </p>

                      </article>
                    ))}

                    {(messageTab === "inbox"
                      ? inboxMessages
                      : sentMessages
                    ).length === 0 && (
                      <div className="empty-state">
                        <MessageCircle size={40} />
                        <h3>
                          {messageTab === "inbox"
                            ? "Your inbox is empty"
                            : "No sent messages yet"}
                        </h3>
                        <p>
                          {messageTab === "inbox"
                            ? "Messages from interested buyers will appear here."
                            : "Messages you send to sellers will appear here."}
                        </p>
                      </div>
                    )}

                  </div>
                )}
              </>
            ) : (

              /* CONVERSATION VIEW */
              <div style={{ maxWidth: "850px", margin: "0 auto" }}>

                <div className="section-heading">
                  <div>
                    <span className="eyebrow">
                      CAMPUSKART CHAT
                    </span>
                    <h2>{activeConversation.userName}</h2>
                    <p>
                      {activeConversation.product?.title || "Product"}
                    </p>
                  </div>

                  <button
                    className="hero-btn"
                    onClick={() => {
                      setActiveConversation(null);
                      setConversationMessages([]);
                      fetchUnreadCount();
                    }}
                  >
                    <ArrowLeft size={17} /> Back to Inbox
                  </button>
                </div>

                {activeConversation.product && (
                  <div style={{
                    padding: "15px",
                    margin: "20px 0",
                    borderRadius: "12px",
                    background: "rgba(255,255,255,0.04)"
                  }}>
                    <strong>
                      {activeConversation.product.title}
                    </strong>
                    <p style={{
                      color: "#ff9a69",
                      marginTop: "5px"
                    }}>
                      ₹{Number(
                        activeConversation.product.price || 0
                      ).toLocaleString("en-IN")}
                    </p>
                  </div>
                )}

                <div style={{
                  background: "rgba(255,255,255,0.03)",
                  borderRadius: "14px",
                  padding: "20px",
                  minHeight: "300px",
                  maxHeight: "480px",
                  overflowY: "auto",
                  display: "flex",
                  flexDirection: "column",
                  gap: "14px"
                }}>

                  {conversationLoading ? (
                    <p>Loading conversation...</p>
                  ) : conversationMessages.map((chat) => {
                    const isMine =
                      chat.sender?._id === user?._id ||
                      chat.sender?._id === user?.id;

                    return (
                      <div
                        key={chat._id}
                        style={{
                          alignSelf: isMine ? "flex-end" : "flex-start",
                          maxWidth: "80%",
                          background: isMine
                            ? "rgba(255,113,57,0.18)"
                            : "rgba(255,255,255,0.08)",
                          border: isMine
                            ? "1px solid rgba(255,113,57,0.35)"
                            : "1px solid rgba(255,255,255,0.08)",
                          borderRadius: "13px",
                          padding: "13px 16px"
                        }}
                      >
                        <p style={{
                          fontSize: "12px",
                          color: "#ffad83",
                          marginBottom: "7px"
                        }}>
                          {isMine ? "You" : chat.sender?.name || "Student"}
                        </p>

                        <p style={{
                          color: "#fff",
                          lineHeight: "1.6",
                          overflowWrap: "anywhere"
                        }}>
                          {chat.text}
                        </p>

                        <p style={{
                          fontSize: "11px",
                          color: "#aaa",
                          marginTop: "8px",
                          textAlign: "right"
                        }}>
                          {formatDate(chat.createdAt)}
                        </p>
                      </div>
                    );
                  })}

                  {!conversationLoading &&
                    conversationMessages.length === 0 && (
                      <p style={{ color: "#aaa" }}>
                        No messages in this conversation yet.
                      </p>
                    )}

                </div>

                {conversationError && (
                  <p className="form-error" style={{ marginTop: "12px" }}>
                    {conversationError}
                  </p>
                )}

                <form
                  onSubmit={handleSendReply}
                  style={{
                    display: "flex",
                    gap: "10px",
                    marginTop: "18px",
                    alignItems: "flex-end"
                  }}
                >
                  <textarea
                    value={conversationText}
                    onChange={(e) => setConversationText(e.target.value)}
                    placeholder="Write your reply..."
                    rows={2}
                    maxLength={1000}
                    required
                    style={{
                      flex: 1,
                      resize: "vertical"
                    }}
                  />

                  <button
                    className="submit-product"
                    type="submit"
                    disabled={sendingReply || !conversationText.trim()}
                    style={{
                      width: "auto",
                      minWidth: "110px",
                      margin: 0
                    }}
                  >
                    <Send size={16} />
                    {sendingReply ? "Sending..." : "Send"}
                  </button>
                </form>

                <p style={{
                  color: "#888",
                  fontSize: "12px",
                  textAlign: "right",
                  marginTop: "5px"
                }}>
                  {conversationText.length}/1000
                </p>

              </div>
            )}

          </section>

        ) : showMyListings ? (

          /* MY LISTINGS PAGE */
          <section
            className="products-section"
            style={{ minHeight: "65vh" }}
          >

            <div className="section-heading">
              <div>
                <span className="eyebrow">
                  YOUR CAMPUSKART ACCOUNT
                </span>
                <h2>My Listings</h2>
                <p>Manage the products you have posted.</p>
              </div>

              <button
                className="hero-btn"
                onClick={() => {
                  setShowMyListings(false);
                  setMessage("");
                }}
              >
                Back to Marketplace
              </button>
            </div>

            {message && (
              <p className="success-message">{message}</p>
            )}

            <div className="product-grid">
              {myListings.map((product) => (
                <article className="product-card" key={product._id}>
                  <div className="product-image">
                    <img
                      src={getImageUrl(
                        product.images?.[0] || product.image
                      )}
                      alt={product.title}
                    />
                    <span className="condition">
                      {product.condition || "Good"}
                    </span>
                  </div>

                  <div className="product-info">
                    <span className="product-category">
                      {product.category}
                    </span>

                    <h3>{product.title}</h3>

                    <div className="price">
                      ₹{Number(product.price).toLocaleString("en-IN")}
                    </div>

                    <p>{product.description}</p>

                    {product.images?.length > 0 && (
                      <p style={{
                        color: "#ff9a69",
                        fontSize: "12px",
                        marginTop: "8px"
                      }}>
                        <Eye size={13} style={{ verticalAlign: "middle" }} />
                        {" "}{product.images.length} image(s) uploaded
                      </p>
                    )}

                    <div className="product-bottom">
                      <span>
                        <MapPin size={14} />
                        {product.location || "College Campus"}
                      </span>

                      <button
                        type="button"
                        onClick={() => handleDeleteProduct(product)}
                        disabled={deletingId === product._id}
                        aria-label={`Delete ${product.title}`}
                        title="Delete product"
                      >
                        <Trash2 size={17} />
                      </button>
                    </div>
                  </div>
                </article>
              ))}
            </div>

            {myListings.length === 0 && (
              <div className="empty-state">
                <h3>You haven't listed any products yet.</h3>
                <p>Your products will appear here after you publish them.</p>
                <button
                  className="hero-btn"
                  onClick={() => {
                    setShowMyListings(false);
                    openSellForm();
                  }}
                >
                  Sell a Product
                </button>
              </div>
            )}

          </section>

        ) : (

          <>
            {/* HERO SECTION */}
            <section className="hero">
              <div className="hero-content">
                <span className="hero-tag">
                  YOUR CAMPUS. YOUR MARKETPLACE.
                </span>

                <h1>
                  Buy Smart.<br />
                  <span>Sell Easy.</span>
                </h1>

                <p>
                  Discover amazing deals from students around your campus.
                  Buy and sell things that matter.
                </p>

                <button
                  className="hero-btn"
                  onClick={() =>
                    document.getElementById("products")?.scrollIntoView({
                      behavior: "smooth"
                    })
                  }
                >
                  Explore Marketplace <span>→</span>
                </button>
              </div>

              <div className="hero-visual">
                <div className="hero-circle">
                  <BookOpen size={65} />
                  <Laptop size={75} />
                  <Heart size={55} />
                </div>

                <div className="floating-card">
                  <span>✦</span> Made for Students
                </div>
              </div>
            </section>

            {/* CATEGORIES */}
            <section className="category-section">
              <div className="section-heading">
                <div>
                  <span className="eyebrow">BROWSE COLLECTIONS</span>
                  <h2>Explore Categories</h2>
                </div>
              </div>

              <div className="categories">
                {categories.map(({ name, icon: Icon }) => (
                  <button
                    key={name}
                    className={`category-card ${
                      category === name ? "active" : ""
                    }`}
                    onClick={() => setCategory(name)}
                  >
                    <Icon size={25} />
                    <span>{name}</span>
                  </button>
                ))}
              </div>
            </section>

            {/* PRODUCTS */}
            <section className="products-section" id="products">
              <div className="section-heading">
                <div>
                  <span className="eyebrow">FIND YOUR NEXT DEAL</span>
                  <h2>Fresh Recommendations</h2>
                </div>

                <span className="result-count">
                  {filteredProducts.length} products
                </span>
              </div>

              {message && !showForm && (
                <p className="success-message">{message}</p>
              )}

              {loading && <p>Loading products...</p>}
              {error && <p>{error}</p>}

              {!loading && !error && (
                <>
                  <div className="product-grid">
                    {filteredProducts.map((product) => (
                      <article
                        className="product-card"
                        key={product._id}
                      >
                        <div className="product-image">
                          <img
                            src={getImageUrl(
                              product.images?.[0] || product.image
                            )}
                            alt={product.title}
                          />

                          <span className="condition">
                            {product.condition || "Good"}
                          </span>

                          <button
                            className={`favorite-btn ${
                              favorites.includes(product._id) ? "liked" : ""
                            }`}
                            onClick={() => toggleFavorite(product._id)}
                          >
                            <Heart
                              size={19}
                              fill={favorites.includes(product._id)
                                ? "currentColor"
                                : "none"}
                            />
                          </button>
                        </div>

                        <div className="product-info">
                          <span className="product-category">
                            {product.category}
                          </span>

                          <h3>{product.title}</h3>

                          <div className="price">
                            ₹{Number(product.price).toLocaleString("en-IN")}
                          </div>

                          <p>{product.description}</p>

                          {product.images?.length > 0 && (
                            <p style={{
                              fontSize: "12px",
                              color: "#ff9a69",
                              marginTop: "8px"
                            }}>
                              <Eye size={13} style={{ verticalAlign: "middle" }} />
                              {" "}{product.images.length} photo(s)
                            </p>
                          )}

                          <div className="product-bottom">
                            <span>
                              <MapPin size={14} />
                              {product.location || "College Campus"}
                            </span>

                            <button
                              type="button"
                              aria-label="Contact seller"
                              title="Contact seller"
                              onClick={() => openContactSeller(product)}
                            >
                              <MessageCircle size={17} />
                            </button>
                          </div>

                          {product.seller?.name && (
                            <p style={{
                              fontSize: "13px",
                              color: "#aaa",
                              marginTop: "10px"
                            }}>
                              Seller: {product.seller.name}
                            </p>
                          )}
                        </div>
                      </article>
                    ))}
                  </div>

                  {filteredProducts.length === 0 && (
                    <div className="empty-state">
                      <Search size={40} />
                      <h3>No products found</h3>
                      <p>
                        Be the first to list a product on CampusKart!
                      </p>
                      <button className="hero-btn" onClick={openSellForm}>
                        Add First Product
                      </button>
                    </div>
                  )}
                </>
              )}
            </section>
          </>
        )}

      </main>

      {/* FOOTER */}
      <footer>
        <div className="footer-logo">
          Campus<span>Kart</span>
        </div>
        <p>Built for students, powered by community.</p>
        <span>© 2026 CampusKart. All rights reserved.</span>
      </footer>

      {/* CONTACT SELLER MODAL */}
      {messageTarget && (
        <div className="modal-overlay">
          <div className="product-modal">
            <div className="modal-heading">
              <div>
                <span className="eyebrow">CAMPUSKART MESSAGING</span>
                <h2>Contact Seller</h2>
              </div>

              <button
                className="close-modal"
                onClick={() => {
                  setMessageTarget(null);
                  setMessageStatus("");
                }}
                disabled={sendingMessage}
              >
                <X size={22} />
              </button>
            </div>

            <div style={{
              background: "rgba(255,255,255,0.04)",
              borderRadius: "12px",
              padding: "15px",
              marginBottom: "20px"
            }}>
              <h3>{messageTarget.title}</h3>
              <p style={{ color: "#ff9a69", marginTop: "8px" }}>
                ₹{Number(messageTarget.price).toLocaleString("en-IN")}
              </p>
              <p style={{
                color: "#aaa",
                marginTop: "8px",
                fontSize: "14px"
              }}>
                Seller: {messageTarget.seller?.name || "Student"}
              </p>
            </div>

            <form onSubmit={handleSendMessage}>
              <label>Your Message *</label>

              <textarea
                value={messageText}
                onChange={(e) => setMessageText(e.target.value)}
                placeholder="Hi, I am interested in this product. Is it available?"
                rows={5}
                maxLength={1000}
                required
              />

              <p style={{
                color: "#888",
                fontSize: "12px",
                textAlign: "right",
                marginTop: "5px"
              }}>
                {messageText.length}/1000
              </p>

              {messageStatus && (
                <p className={
                  messageStatus.toLowerCase().includes("success")
                    ? "success-message"
                    : "form-error"
                }>
                  {messageStatus}
                </p>
              )}

              <button
                className="submit-product"
                type="submit"
                disabled={sendingMessage || !messageText.trim()}
              >
                {sendingMessage ? "Sending..." : "Send Message"}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* DELETE CONFIRMATION MODAL */}
      {deleteTarget && (
        <div className="modal-overlay">
          <div className="product-modal">
            <div className="modal-heading">
              <div>
                <span className="eyebrow">CAMPUSKART</span>
                <h2>Delete Product?</h2>
              </div>

              <button
                className="close-modal"
                onClick={() => setDeleteTarget(null)}
                disabled={Boolean(deletingId)}
              >
                <X size={22} />
              </button>
            </div>

            <div style={{
              textAlign: "center",
              padding: "20px 0"
            }}>
              <div style={{
                width: "65px",
                height: "65px",
                borderRadius: "50%",
                background: "rgba(255, 126, 58, 0.15)",
                color: "#ff7e3a",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                margin: "0 auto 18px"
              }}>
                <Trash2 size={30} />
              </div>

              <h3 style={{ marginBottom: "10px" }}>
                Are you sure?
              </h3>

              <p style={{
                color: "#aaa",
                lineHeight: "1.6"
              }}>
                Do you really want to delete
                <strong style={{ color: "#fff" }}>
                  {" "}{deleteTarget.title}{" "}
                </strong>
                from your listings?
              </p>

              <p style={{
                color: "#ff8b68",
                fontSize: "13px",
                marginTop: "12px"
              }}>
                This action cannot be undone.
              </p>
            </div>

            <div style={{
              display: "flex",
              gap: "12px",
              marginTop: "10px"
            }}>
              <button
                type="button"
                className="login-btn"
                style={{ flex: 1, justifyContent: "center" }}
                onClick={() => setDeleteTarget(null)}
                disabled={Boolean(deletingId)}
              >
                Cancel
              </button>

              <button
                type="button"
                className="submit-product"
                style={{ flex: 1, background: "#ff7139" }}
                onClick={confirmDeleteProduct}
                disabled={Boolean(deletingId)}
              >
                {deletingId ? "Deleting..." : "Yes, Delete"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* LOGIN / REGISTER MODAL */}
      {showAuth && (
        <div className="modal-overlay">
          <div className="product-modal">
            <div className="modal-heading">
              <div>
                <span className="eyebrow">WELCOME TO CAMPUSKART</span>
                <h2>
                  {authMode === "login"
                    ? "Student Login"
                    : "Create Account"}
                </h2>
              </div>

              <button
                className="close-modal"
                onClick={() => setShowAuth(false)}
              >
                <X size={22} />
              </button>
            </div>

            <div style={{
              display: "flex",
              gap: "10px",
              marginBottom: "22px"
            }}>
              <button
                type="button"
                className="submit-product"
                style={{ opacity: authMode === "login" ? 1 : 0.55 }}
                onClick={() => {
                  setAuthMode("login");
                  setAuthMessage("");
                }}
              >
                Login
              </button>

              <button
                type="button"
                className="submit-product"
                style={{ opacity: authMode === "register" ? 1 : 0.55 }}
                onClick={() => {
                  setAuthMode("register");
                  setAuthMessage("");
                }}
              >
                Register
              </button>
            </div>

            <form onSubmit={handleAuthSubmit}>
              {authMode === "register" && (
                <>
                  <label>Full Name *</label>
                  <input
                    name="name"
                    value={authForm.name}
                    onChange={handleAuthChange}
                    placeholder="Enter your full name"
                    required
                  />
                </>
              )}

              <label>Email Address *</label>
              <input
                type="email"
                name="email"
                value={authForm.email}
                onChange={handleAuthChange}
                placeholder="Enter your email"
                required
              />

              <label>Password *</label>
              <input
                type="password"
                name="password"
                value={authForm.password}
                onChange={handleAuthChange}
                placeholder="Enter your password"
                minLength={8}
                required
              />

              {authMessage && (
                <p className="form-error">{authMessage}</p>
              )}

              <button
                className="submit-product"
                type="submit"
                disabled={authLoading}
              >
                {authLoading
                  ? "Please wait..."
                  : authMode === "login"
                    ? "Login to CampusKart"
                    : "Create My Account"}
              </button>
            </form>

            <p style={{
              textAlign: "center",
              marginTop: "18px",
              color: "#aaa",
              fontSize: "14px"
            }}>
              {authMode === "login"
                ? "New to CampusKart? Create an account."
                : "Already have an account? Login instead."}
            </p>
          </div>
        </div>
      )}

      {/* ADD PRODUCT MODAL */}
      {showForm && (
        <div className="modal-overlay">
          <div className="product-modal">
            <div className="modal-heading">
              <div>
                <span className="eyebrow">SELL ON CAMPUSKART</span>
                <h2>Add Your Product</h2>
              </div>

              <button
                className="close-modal"
                onClick={() => {
                  resetProductForm();
                  setShowForm(false);
                }}
                disabled={saving}
              >
                <X size={22} />
              </button>
            </div>

            <form onSubmit={handleSubmit}>
              <label>Product Name *</label>
              <input
                name="title"
                value={form.title}
                onChange={handleChange}
                placeholder="e.g. Engineering Mathematics Book"
                required
              />

              <label>Description *</label>
              <textarea
                name="description"
                value={form.description}
                onChange={handleChange}
                placeholder="Describe your product..."
                required
              />

              <label>Price (₹) *</label>
              <input
                type="number"
                name="price"
                value={form.price}
                onChange={handleChange}
                placeholder="Enter price"
                min="1"
                required
              />

              <label>Category *</label>
              <select
                name="category"
                value={form.category}
                onChange={handleChange}
              >
                {categories
                  .filter((item) => item.name !== "All")
                  .map((item) => (
                    <option key={item.name} value={item.name}>
                      {item.name}
                    </option>
                  ))}
              </select>

              <label>Condition</label>
              <select
                name="condition"
                value={form.condition}
                onChange={handleChange}
              >
                <option>New</option>
                <option>Like New</option>
                <option>Good</option>
                <option>Fair</option>
              </select>

              {/* MULTIPLE IMAGE UPLOAD */}
              <label>Upload Product Images (Maximum 5)</label>

              <div style={{
                border: "1px dashed rgba(255,255,255,0.3)",
                borderRadius: "12px",
                padding: "18px",
                marginTop: "10px",
                marginBottom: "15px",
                textAlign: "center",
                background: "rgba(255,255,255,0.03)"
              }}>
                <ImagePlus
                  size={35}
                  color="#ff9a69"
                  style={{ marginBottom: "8px" }}
                />

                <p style={{
                  color: "#ddd",
                  fontSize: "14px",
                  marginBottom: "10px"
                }}>
                  Select photos from your computer
                </p>

                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  multiple
                  onChange={handleImageChange}
                  disabled={selectedImages.length >= 5}
                  style={{
                    display: "block",
                    width: "100%",
                    color: "#ddd",
                    marginTop: "10px"
                  }}
                />

                <p style={{
                  color: "#999",
                  fontSize: "12px",
                  marginTop: "10px"
                }}>
                  JPG, PNG, WebP or GIF · Maximum 5 MB per image
                </p>

                <p style={{
                  color: "#ff9a69",
                  fontSize: "13px",
                  marginTop: "8px"
                }}>
                  {selectedImages.length}/5 images selected
                </p>
              </div>

              {imageError && (
                <p className="form-error">{imageError}</p>
              )}

              {/* IMAGE PREVIEWS */}
              {imagePreviews.length > 0 && (
                <div style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill, minmax(105px, 1fr))",
                  gap: "12px",
                  marginBottom: "18px"
                }}>
                  {imagePreviews.map((preview, index) => (
                    <div
                      key={`${preview}-${index}`}
                      style={{
                        position: "relative",
                        borderRadius: "10px",
                        overflow: "hidden",
                        border: "1px solid rgba(255,255,255,0.15)"
                      }}
                    >
                      <img
                        src={preview}
                        alt={`Product preview ${index + 1}`}
                        style={{
                          width: "100%",
                          height: "100px",
                          objectFit: "cover",
                          display: "block"
                        }}
                      />

                      <button
                        type="button"
                        onClick={() => removeSelectedImage(index)}
                        title="Remove image"
                        style={{
                          position: "absolute",
                          top: "5px",
                          right: "5px",
                          width: "25px",
                          height: "25px",
                          borderRadius: "50%",
                          border: "none",
                          background: "#e34b35",
                          color: "#fff",
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center"
                        }}
                      >
                        <X size={15} />
                      </button>

                      <span style={{
                        display: "block",
                        padding: "5px",
                        fontSize: "11px",
                        color: "#ddd",
                        textAlign: "center",
                        background: "rgba(0,0,0,0.5)"
                      }}>
                        Image {index + 1}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              <label>Image URL (optional alternative)</label>
              <input
                name="image"
                value={form.image}
                onChange={handleChange}
                placeholder="Paste an image URL if not uploading a file"
              />

              <label>Location</label>
              <input
                name="location"
                value={form.location}
                onChange={handleChange}
                placeholder="Your college or campus"
              />

              {message && (
                <p className="form-error">{message}</p>
              )}

              <button
                className="submit-product"
                type="submit"
                disabled={saving}
              >
                {saving ? "Uploading Images & Publishing..." : "Publish Product"}
              </button>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}

export default App;
