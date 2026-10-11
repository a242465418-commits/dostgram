
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "./supabase";
import "./App.css";

const MAX_FILE_SIZE = 50 * 1024 * 1024;
const AVATAR_MAX_SIZE = 5 * 1024 * 1024;

function Icon({ children }) {
  return <span className="icon">{children}</span>;
}

function Avatar({ name = "D", size = "normal", src = "" }) {
  return (
    <div className={`avatar ${size} ${src ? "avatar-has-photo" : ""}`}>
      {src ? (
        <img src={src} alt={`${name}'s profile`} />
      ) : (
        (name || "D").charAt(0).toUpperCase()
      )}
    </div>
  );
}

function Auth() {
  const [mode, setMode] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");

    try {
      if (mode === "signup") {
        const clean = username.trim();
        if (!/^[a-zA-Z0-9._]{3,24}$/.test(clean)) {
          throw new Error("Username must be 3–24 characters: letters, numbers, . or _.");
        }

        const { error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: { data: { username: clean } },
        });
        if (error) throw error;
        setMessage("Account created! Check your email if confirmation is required.");
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (error) throw error;
      }
    } catch (err) {
      setError(err.message || "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="auth-screen">
      <form className="auth-card" onSubmit={submit}>
        <div className="brand-mark">d.</div>
        <p className="eyebrow">YOUR PEOPLE. YOUR SPACE.</p>
        <h1>{mode === "login" ? "Welcome back." : "Join DostGram."}</h1>
        <p className="muted">A little closer, wherever you are.</p>

        {mode === "signup" && (
          <input
            required
            minLength={3}
            maxLength={24}
            value={username}
            onChange={(e) => setUsername(e.target.value.replace(/\s/g, ""))}
            placeholder="Username"
            autoComplete="username"
          />
        )}

        <input
          required
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email address"
          autoComplete="email"
        />
        <input
          required
          minLength={6}
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password"
          autoComplete={mode === "login" ? "current-password" : "new-password"}
        />

        {error && <p className="error-text">{error}</p>}
        {message && <p className="success-text">{message}</p>}

        <button className="primary-button" disabled={busy}>
          {busy ? "Please wait…" : mode === "login" ? "Log in" : "Create account"}
        </button>

        <p className="auth-switch">
          {mode === "login" ? "New here?" : "Already have an account?"}{" "}
          <button
            type="button"
            className="text-button"
            onClick={() => {
              setMode(mode === "login" ? "signup" : "login");
              setError("");
              setMessage("");
            }}
          >
            {mode === "login" ? "Sign up" : "Log in"}
          </button>
        </p>
      </form>
    </main>
  );
}

export default function App() {
  const [session, setSession] = useState(null);
  const [checking, setChecking] = useState(true);
  const [page, setPage] = useState("Home");
  const [notice, setNotice] = useState("");
  const [posts, setPosts] = useState([]);
  const [profiles, setProfiles] = useState([]);
  const [messages, setMessages] = useState([]);
  const [search, setSearch] = useState("");
  const [chatSearch, setChatSearch] = useState("");
  const [selectedUser, setSelectedUser] = useState(null);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [liked, setLiked] = useState([]);
  const [saved, setSaved] = useState([]);
  const [commentText, setCommentText] = useState({});
  const [expandedComments, setExpandedComments] = useState([]);
  const [showCreate, setShowCreate] = useState(false);
  const [postCaption, setPostCaption] = useState("");
  const [postFile, setPostFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [selectedStory, setSelectedStory] = useState(null);
  const [hiddenMessageIds, setHiddenMessageIds] = useState([]);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [editingProfile, setEditingProfile] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [usernameDraft, setUsernameDraft] = useState("");
  const [bio, setBio] = useState("");
  const [followRows, setFollowRows] = useState([]);
  const bottomRef = useRef(null);

  const user = session?.user;
  const myProfile = profiles.find((p) => p.id === user?.id);
  const myAvatarUrl = myProfile?.avatarUrl || "";
  const username =
    myProfile?.username ||
    user?.user_metadata?.username ||
    user?.email?.split("@")[0] ||
    "friend";

  const flash = useCallback((text) => {
    setNotice(text);
    window.setTimeout(() => setNotice(""), 3500);
  }, []);

  useEffect(() => {
    let active = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setSession(data.session);
      setChecking(false);
    });

    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setChecking(false);
    });

    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, []);

  const loadProfiles = useCallback(async () => {
    if (!user) return;

    const { data: existing, error } = await supabase
      .from("profiles")
      .select("id, username, avatar_path, bio")
      .order("username");

    if (error) {
      flash("Couldn't load users: " + error.message);
      return;
    }

    let rows = existing || [];
    if (!rows.some((p) => p.id === user.id)) {
      const base = (
        user.user_metadata?.username ||
        user.email?.split("@")[0] ||
        "user"
      ).replace(/\s/g, "").slice(0, 24) || "user";

      let candidate = base;
      if (rows.some((p) => p.username?.toLowerCase() === base.toLowerCase())) {
        candidate = `${base.slice(0, 16)}_${user.id.slice(0, 6)}`;
      }

      const { error: insertError } = await supabase.from("profiles").insert({
        id: user.id,
        username: candidate,
        bio: "",
      });

      if (insertError && insertError.code !== "23505") {
        flash("Profile setup: " + insertError.message);
      }

      const { data: refreshed } = await supabase
        .from("profiles")
        .select("id, username, avatar_path, bio")
        .order("username");

      if (refreshed) rows = refreshed;
    }

    const profilesWithPhotos = await Promise.all(
      rows.map(async (profile) => {
        if (!profile.avatar_path) return { ...profile, avatarUrl: "" };

        const { data, error: photoError } = await supabase.storage
          .from("posts")
          .createSignedUrl(profile.avatar_path, 3600);

        return {
          ...profile,
          avatarUrl: photoError ? "" : data?.signedUrl || "",
        };
      })
    );

    setProfiles(profilesWithPhotos);
    const mine = profilesWithPhotos.find((p) => p.id === user.id);
    setBio(mine?.bio || "");
  }, [user, flash]);

  useEffect(() => {
    if (user) loadProfiles();
    else {
      setProfiles([]);
      setBio("");
    }
  }, [user?.id, loadProfiles]);

  const loadFollows = useCallback(async () => {
    if (!user) return;

    const { data, error } = await supabase
      .from("follows")
      .select("follower_id, following_id");

    if (error) {
      flash("Couldn't load follows: " + error.message);
      return;
    }
    setFollowRows(data || []);
  }, [user?.id, flash]);

  useEffect(() => {
    if (user) loadFollows();
    else setFollowRows([]);
  }, [user?.id, loadFollows]);

  const followerCount = followRows.filter(
    (f) => f.following_id === user?.id
  ).length;

  const followingCount = followRows.filter(
    (f) => f.follower_id === user?.id
  ).length;

  async function saveProfile(e) {
    e.preventDefault();
    if (!user || savingProfile) return;

    const cleanUsername = usernameDraft.trim();
    const cleanBio = bio.trim().slice(0, 160);

    if (!/^[a-zA-Z0-9._]{3,24}$/.test(cleanUsername)) {
      flash("Username must be 3–24 characters: letters, numbers, . or _.");
      return;
    }

    setSavingProfile(true);

    try {
      const { data: duplicate, error: checkError } = await supabase
        .from("profiles")
        .select("id")
        .ilike("username", cleanUsername)
        .neq("id", user.id)
        .limit(1);

      if (checkError) throw checkError;
      if (duplicate?.length) throw new Error("That username is already taken.");

      const { error } = await supabase
        .from("profiles")
        .update({ username: cleanUsername, bio: cleanBio })
        .eq("id", user.id);

      if (error) throw error;

      await loadProfiles();
      setEditingProfile(false);
      flash("Profile updated! ✨");
    } catch (err) {
      flash(err.message || "Couldn't update profile.");
    } finally {
      setSavingProfile(false);
    }
  }

  async function toggleFollow(targetId) {
    if (!user || targetId === user.id) return;

    const alreadyFollowing = followRows.some(
      (f) => f.follower_id === user.id && f.following_id === targetId
    );

    if (alreadyFollowing) {
      const { error } = await supabase
        .from("follows")
        .delete()
        .eq("follower_id", user.id)
        .eq("following_id", targetId);

      if (error) {
        flash("Couldn't unfollow: " + error.message);
        return;
      }
    } else {
      const { error } = await supabase.from("follows").insert({
        follower_id: user.id,
        following_id: targetId,
      });

      if (error) {
        flash("Couldn't follow: " + error.message);
        return;
      }
    }

    await loadFollows();
  }

  async function handleAvatarUpload(e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !user) return;

    if (!file.type.startsWith("image/")) {
      flash("Choose an image file.");
      return;
    }
    if (file.size > AVATAR_MAX_SIZE) {
      flash("Profile photo must be 5 MB or smaller.");
      return;
    }

    setAvatarUploading(true);
    const extension = file.name.split(".").pop()?.replace(/[^a-zA-Z0-9]/g, "") || "jpg";
    const path = `${user.id}/avatars/${Date.now()}.${extension}`;

    try {
      const { error: uploadError } = await supabase.storage
        .from("posts")
        .upload(path, file, {
          upsert: false,
          contentType: file.type,
        });

      if (uploadError) throw uploadError;

      const { error: updateError } = await supabase
        .from("profiles")
        .update({ avatar_path: path })
        .eq("id", user.id);

      if (updateError) {
        await supabase.storage.from("posts").remove([path]);
        throw updateError;
      }

      await loadProfiles();
      flash("Profile photo updated! 🟢");
    } catch (err) {
      flash("Photo upload failed: " + (err.message || "Try again."));
    } finally {
      setAvatarUploading(false);
    }
  }

  const loadPosts = useCallback(async () => {
    if (!user) return;

    const { data, error } = await supabase
      .from("posts")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      flash("Couldn't load posts: " + error.message);
      return;
    }

    const mapped = await Promise.all(
      (data || []).map(async (post) => {
        const { data: signed } = await supabase.storage
          .from("posts")
          .createSignedUrl(post.media_path, 3600);

        return {
          ...post,
          image: signed?.signedUrl || "",
          username: post.username || "friend",
        };
      })
    );

    setPosts(mapped);
  }, [user?.id, flash]);

  useEffect(() => {
    if (user) loadPosts();
    else setPosts([]);
  }, [user?.id, loadPosts]);

  const loadMessages = useCallback(async () => {
    if (!user) return;

    const { data, error } = await supabase
      .from("messages")
      .select("id, sender_id, receiver_id, content, created_at, read_at")
      .order("created_at", { ascending: true })
      .limit(1000);

    if (error) {
      flash("Couldn't load messages: " + error.message);
      return;
    }
    setMessages(data || []);
  }, [user?.id, flash]);

  const markChatAsRead = useCallback(async () => {
    if (!user || !selectedUser || page !== "Messages") return;

    const { error } = await supabase.rpc("mark_messages_read", {
      p_sender_id: selectedUser.id,
    });

    if (error) {
      console.error("Read receipt error:", error.message);
      return;
    }
    await loadMessages();
  }, [user?.id, selectedUser?.id, page, loadMessages]);

  useEffect(() => {
    markChatAsRead();
  }, [markChatAsRead]);

  useEffect(() => {
    if (!user) {
      setMessages([]);
      return;
    }

    loadMessages();

    const channel = supabase
      .channel(`messages-${user.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "messages" },
        () => loadMessages()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, loadMessages]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, selectedUser?.id, page]);

  const navItems = [
    ["Home", "⌂"],
    ["Search", "⌕"],
    ["Explore", "▦"],
    ["Reels", "▷"],
    ["Messages", "➤"],
    ["Notifications", "♡"],
    ["Create", "+"],
    ["Profile", "◉"],
  ];

  async function logout() {
    await supabase.auth.signOut();
    setSelectedUser(null);
    flash("Logged out.");
  }

  async function createPost(e) {
    e.preventDefault();
    if (!user || !postFile) return;

    if (postFile.size > MAX_FILE_SIZE) {
      flash("File is too large. Maximum size is 50 MB.");
      return;
    }

    const isVideo = postFile.type.startsWith("video/");
    const isImage = postFile.type.startsWith("image/");
    if (!isImage && !isVideo) {
      flash("Choose an image or video.");
      return;
    }

    setUploading(true);
    const safeName = postFile.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const path = `${user.id}/${Date.now()}-${safeName}`;

    try {
      const { error: uploadError } = await supabase.storage
        .from("posts")
        .upload(path, postFile, {
          upsert: false,
          contentType: postFile.type,
        });

      if (uploadError) throw uploadError;

      const { data: row, error: insertError } = await supabase
        .from("posts")
        .insert({
          user_id: user.id,
          username,
          caption: postCaption.trim(),
          media_path: path,
          media_type: isVideo ? "video" : "image",
        })
        .select()
        .single();

      if (insertError) throw insertError;

      const { data: signed } = await supabase.storage
        .from("posts")
        .createSignedUrl(path, 3600);

      setPosts((prev) => [
        { ...row, image: signed?.signedUrl || "" },
        ...prev,
      ]);
      setPostCaption("");
      setPostFile(null);
      setShowCreate(false);
      flash("Post shared! ✨");
    } catch (err) {
      await supabase.storage.from("posts").remove([path]);
      flash(err.message || "Upload failed.");
    } finally {
      setUploading(false);
    }
  }

  async function deletePost(post) {
    if (post.user_id !== user.id) return;
    if (!window.confirm("Delete this post permanently?")) return;

    setDeletingId(post.id);

    const { data, error } = await supabase
      .from("posts")
      .delete()
      .eq("id", post.id)
      .eq("user_id", user.id)
      .select("id");

    if (error || !data?.length) {
      flash(error?.message || "Couldn't delete post.");
      setDeletingId(null);
      return;
    }

    setPosts((prev) => prev.filter((p) => p.id !== post.id));

    const { error: storageError } = await supabase.storage
      .from("posts")
      .remove([post.media_path]);

    flash(storageError ? "Post deleted; media cleanup may be needed." : "Post deleted.");
    setDeletingId(null);
  }

  async function deleteForMe(message) {
    setHiddenMessageIds((prev) => [...new Set([...prev, message.id])]);
  }

  async function deleteForEveryone(message) {
    if (message.sender_id !== user.id) {
      flash("You can delete only your own messages for everyone.");
      return;
    }
    if (!window.confirm("Delete this message for everyone?")) return;

    const { error } = await supabase
      .from("messages")
      .delete()
      .eq("id", message.id)
      .eq("sender_id", user.id);

    if (error) {
      flash("Couldn't delete message: " + error.message);
      return;
    }

    setMessages((prev) => prev.filter((m) => m.id !== message.id));
    flash("Message deleted for everyone.");
  }

  async function sendMessage(e) {
    e.preventDefault();
    const content = draft.trim();

    if (!content || !selectedUser || sending) return;
    if (selectedUser.id === user.id) {
      flash("You can't message yourself.");
      return;
    }

    setSending(true);

    const { data, error } = await supabase
      .from("messages")
      .insert({
        sender_id: user.id,
        receiver_id: selectedUser.id,
        content,
      })
      .select("id, sender_id, receiver_id, content, created_at, read_at")
      .single();

    if (error) {
      flash("Message failed: " + error.message);
    } else {
      setMessages((prev) =>
        prev.some((m) => m.id === data.id) ? prev : [...prev, data]
      );
      setDraft("");
    }
    setSending(false);
  }

  const conversations = useMemo(() => {
    const latest = new Map();

    for (const message of messages) {
      const otherId =
        message.sender_id === user?.id
          ? message.receiver_id
          : message.sender_id;

      if (otherId === user?.id) continue;

      const previous = latest.get(otherId);
      if (
        !previous ||
        new Date(message.created_at) > new Date(previous.created_at)
      ) {
        latest.set(otherId, message);
      }
    }

    return [...latest.entries()]
      .map(([id, message]) => ({
        profile: profiles.find((p) => p.id === id),
        message,
      }))
      .filter((item) => item.profile)
      .sort(
        (a, b) =>
          new Date(b.message.created_at) - new Date(a.message.created_at)
      );
  }, [messages, profiles, user?.id]);

  const filteredProfiles = useMemo(() => {
    const q = chatSearch.trim().toLowerCase();
    return profiles
      .filter((p) => p.id !== user?.id)
      .filter((p) => !q || p.username.toLowerCase().includes(q))
      .slice(0, 50);
  }, [profiles, chatSearch, user?.id]);

  const chatMessages = useMemo(() => {
    if (!selectedUser) return [];

    return messages.filter(
      (m) =>
        (m.sender_id === user.id && m.receiver_id === selectedUser.id) ||
        (m.sender_id === selectedUser.id && m.receiver_id === user.id)
    );
  }, [messages, selectedUser?.id, user?.id]);

  function openChat(profile) {
    setSelectedUser(profile);
    setPage("Messages");
    setChatSearch("");
  }

  function FollowButton({ profile }) {
    const isFollowing = followRows.some(
      (f) => f.follower_id === user.id && f.following_id === profile.id
    );

    return (
      <button
        className={`follow-button ${isFollowing ? "is-following" : ""}`}
        onClick={() => toggleFollow(profile.id)}
      >
        {isFollowing ? "Following ✓" : "Follow +"}
      </button>
    );
  }

  function renderPost(post) {
    const isMine = post.user_id === user.id;
    const isLiked = liked.includes(post.id);
    const isSaved = saved.includes(post.id);
    const comments = commentText[post.id] || [];
    const author = profiles.find((p) => p.id === post.user_id);

    return (
      <article className="post-card" key={post.id}>
        <header className="post-header">
          <div className="user-line">
            <Avatar name={post.username} src={author?.avatarUrl || ""} />
            <div>
              <strong>{post.username}</strong>
              <p className="muted">
                {new Date(post.created_at || Date.now()).toLocaleString()}
              </p>
            </div>
          </div>

          {isMine && (
            <button
              className="icon-button danger-button"
              disabled={deletingId === post.id}
              onClick={() => deletePost(post)}
              title="Delete post"
            >
              {deletingId === post.id ? "…" : "🗑"}
            </button>
          )}
        </header>

        {post.image ? (
          post.media_type === "video" ? (
            <video className="post-media" src={post.image} controls playsInline />
          ) : (
            <img
              className="post-media"
              src={post.image}
              alt={post.caption || "Post"}
            />
          )
        ) : (
          <div className="media-unavailable">
            Media unavailable. Refresh the page.
          </div>
        )}

        <div className="post-actions">
          <button
            onClick={() =>
              setLiked((prev) =>
                isLiked
                  ? prev.filter((id) => id !== post.id)
                  : [...prev, post.id]
              )
            }
          >
            {isLiked ? "♥" : "♡"} Like
          </button>

          <button
            onClick={() =>
              setExpandedComments((prev) =>
                prev.includes(post.id)
                  ? prev.filter((id) => id !== post.id)
                  : [...prev, post.id]
              )
            }
          >
            💬 Comment
          </button>

          <button
            className="save-action"
            onClick={() =>
              setSaved((prev) =>
                isSaved
                  ? prev.filter((id) => id !== post.id)
                  : [...prev, post.id]
              )
            }
          >
            {isSaved ? "🔖" : "♧"} Save
          </button>
        </div>

        {post.caption && (
          <p className="post-caption">
            <strong>{post.username}</strong> {post.caption}
          </p>
        )}

        {expandedComments.includes(post.id) && (
          <form
            className="comment-form"
            onSubmit={(e) => {
              e.preventDefault();
              const value = e.currentTarget.elements.comment.value.trim();
              if (!value) return;

              setCommentText((prev) => ({
                ...prev,
                [post.id]: [...(prev[post.id] || []), value],
              }));
              e.currentTarget.reset();
            }}
          >
            {comments.map((comment, i) => (
              <p key={i}>
                <strong>{username}</strong> {comment}
              </p>
            ))}
            <input name="comment" placeholder="Add a comment…" maxLength={500} />
            <button type="submit">Post</button>
          </form>
        )}
      </article>
    );
  }

  if (checking) return <main className="loading-screen">Opening DostGram…</main>;
  if (!session) return <Auth />;

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <button className="brand" onClick={() => setPage("Home")}>
          dost<span>gram.</span>
        </button>

        <nav>
          {navItems.map(([name, symbol]) => (
            <button
              key={name}
              className={`nav-item ${page === name ? "active" : ""}`}
              onClick={() =>
                name === "Create" ? setShowCreate(true) : setPage(name)
              }
            >
              <Icon>{symbol}</Icon>
              <span>{name}</span>
            </button>
          ))}
        </nav>

        <div className="sidebar-bottom">
          <div className="user-line">
            <Avatar name={username} src={myAvatarUrl} />
            <strong>{username}</strong>
          </div>
          <button className="nav-item" onClick={logout}>
            <Icon>↪</Icon>
            <span>Log out</span>
          </button>
        </div>
      </aside>

      <main className="main-area">
        <header className="mobile-header">
          <button className="brand" onClick={() => setPage("Home")}>
            dost<span>gram.</span>
          </button>
          <button onClick={logout}>Log out ↪</button>
        </header>

        {page === "Home" && (
          <div className="feed-layout">
            <section className="feed-column">
              <div className="stories-strip">
                <button className="story" onClick={() => setShowCreate(true)}>
                  <span className="story-ring">
                    <Avatar name={username} src={myAvatarUrl} />
                  </span>
                  <small>Your story +</small>
                </button>

                {profiles
                  .filter((p) => p.id !== user.id)
                  .slice(0, 8)
                  .map((p) => (
                    <button
                      className="story"
                      key={p.id}
                      onClick={() => setSelectedStory(p)}
                    >
                      <span className="story-ring">
                        <Avatar name={p.username} src={p.avatarUrl} />
                      </span>
                      <small>{p.username}</small>
                    </button>
                  ))}
              </div>

              {posts.length ? (
                posts.map(renderPost)
              ) : (
                <div className="empty-feature">
                  <h2>Your feed starts here.</h2>
                  <p>Share your first photo or video.</p>
                  <button
                    className="primary-button"
                    onClick={() => setShowCreate(true)}
                  >
                    Create a post
                  </button>
                </div>
              )}
            </section>

            <aside className="right-column">
              <div className="user-line">
                <Avatar name={username} src={myAvatarUrl} />
                <div>
                  <strong>{username}</strong>
                  <p className="muted">{user.email}</p>
                </div>
              </div>

              <h3>People to discover</h3>
              {profiles
                .filter((p) => p.id !== user.id)
                .slice(0, 6)
                .map((p) => (
                  <div className="suggestion-row" key={p.id}>
                    <Avatar name={p.username} src={p.avatarUrl} />
                    <strong>{p.username}</strong>
                    <FollowButton profile={p} />
                    <button className="text-button" onClick={() => openChat(p)}>
                      Message
                    </button>
                  </div>
                ))}

              <p className="muted footer-note">Made for your people. © DostGram</p>
            </aside>
          </div>
        )}

        {page === "Search" && (
          <section className="secondary-page">
            <p className="eyebrow">FIND YOUR PEOPLE</p>
            <h1>Search<span className="heading-period">.</span></h1>
            <input
              className="search-input"
              placeholder="Search usernames…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />

            <div className="profile-results">
              {profiles
                .filter((p) => p.id !== user.id)
                .filter((p) => p.username.toLowerCase().includes(search.toLowerCase()))
                .map((p) => (
                  <div className="suggestion-row" key={p.id}>
                    <Avatar name={p.username} src={p.avatarUrl} />
                    <strong>{p.username}</strong>
                    <FollowButton profile={p} />
                    <button className="text-button" onClick={() => openChat(p)}>
                      Message
                    </button>
                  </div>
                ))}
            </div>
          </section>
        )}

        {page === "Explore" && (
          <section className="secondary-page">
            <p className="eyebrow">A LITTLE INSPIRATION</p>
            <h1>Explore<span className="heading-period">.</span></h1>
            <div className="explore-grid">
              {posts.map((p) => (
                <button
                  key={p.id}
                  onClick={() => setPage(p.media_type === "video" ? "Reels" : "Home")}
                >
                  {p.media_type === "video" ? "▷" : <img src={p.image} alt="" />}
                </button>
              ))}
            </div>
          </section>
        )}

        {page === "Reels" && (
          <section className="secondary-page">
            <p className="eyebrow">SHORTS & MOMENTS</p>
            <h1>Reels<span className="heading-period">.</span></h1>
            <div className="reels-grid">
              {posts.filter((p) => p.media_type === "video").map(renderPost)}
              {!posts.some((p) => p.media_type === "video") && (
                <p className="muted">No reels yet. Upload a video to get started.</p>
              )}
            </div>
          </section>
        )}

        {page === "Messages" && (
          <section className="secondary-page messages-page">
            <p className="eyebrow">JUST BETWEEN YOU</p>
            <h1>Messages<span className="heading-period">.</span></h1>

            <div className="chat-layout">
              <aside className="chat-people">
                <input
                  className="search-input"
                  value={chatSearch}
                  onChange={(e) => setChatSearch(e.target.value)}
                  placeholder="Find a person…"
                />

                {conversations.map(({ profile, message }) => (
                  <button
                    key={profile.id}
                    className={`chat-person ${selectedUser?.id === profile.id ? "selected" : ""}`}
                    onClick={() => setSelectedUser(profile)}
                  >
                    <Avatar name={profile.username} src={profile.avatarUrl} />
                    <span>
                      <strong>{profile.username}</strong>
                      <small>{message.content}</small>
                    </span>
                  </button>
                ))}

                <p className="chat-label">START A CHAT</p>
                {filteredProfiles.map((p) => (
                  <button
                    key={p.id}
                    className={`chat-person ${selectedUser?.id === p.id ? "selected" : ""}`}
                    onClick={() => setSelectedUser(p)}
                  >
                    <Avatar name={p.username} src={p.avatarUrl} />
                    <span>
                      <strong>{p.username}</strong>
                      <small>Open conversation</small>
                    </span>
                  </button>
                ))}
              </aside>

              <div className="chat-window">
                {selectedUser ? (
                  <>
                    <header className="chat-header">
                      <Avatar name={selectedUser.username} src={selectedUser.avatarUrl} />
                      <div>
                        <strong>{selectedUser.username}</strong>
                        <small>Private conversation</small>
                      </div>
                    </header>

                    <div className="chat-history">
                      {chatMessages
                        .filter((m) => !hiddenMessageIds.includes(m.id))
                        .map((m) => (
                          <div
                            key={m.id}
                            className={`message-row ${m.sender_id === user.id ? "mine" : "theirs"}`}
                          >
                            <div className="message-bubble">
                              <p>{m.content}</p>
                              <small>
                                {new Date(m.created_at).toLocaleTimeString([], {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })}
                              </small>

                              {m.sender_id === user.id && (
                                <small className="read-receipt">
                                  {m.read_at ? "Seen ✓✓" : "Sent ✓"}
                                </small>
                              )}

                              <details className="message-menu">
                                <summary>•••</summary>
                                <button type="button" onClick={() => deleteForMe(m)}>
                                  Delete for me
                                </button>
                                {m.sender_id === user.id && (
                                  <button
                                    type="button"
                                    onClick={() => deleteForEveryone(m)}
                                  >
                                    Delete for everyone
                                  </button>
                                )}
                              </details>
                            </div>
                          </div>
                        ))}

                      {!chatMessages.length && (
                        <div className="chat-empty">
                          <h2>Say hello 👋</h2>
                          <p>Your conversation starts here.</p>
                        </div>
                      )}
                      <div ref={bottomRef} />
                    </div>

                    <form className="message-composer" onSubmit={sendMessage}>
                      <input
                        value={draft}
                        onChange={(e) => setDraft(e.target.value)}
                        placeholder="Write a message…"
                        maxLength={2000}
                      />
                      <button
                        className="primary-button"
                        disabled={sending || !draft.trim()}
                      >
                        {sending ? "…" : "Send ➤"}
                      </button>
                    </form>
                  </>
                ) : (
                  <div className="chat-empty">
                    <span className="chat-big-icon">➤</span>
                    <h2>Your people are one message away.</h2>
                    <p>Choose a username to start chatting.</p>
                  </div>
                )}
              </div>
            </div>
          </section>
        )}

        {page === "Notifications" && (
          <section className="secondary-page">
            <p className="eyebrow">THE LATEST</p>
            <h1>Notifications<span className="heading-period">.</span></h1>
            <div className="empty-feature">
              <h2>You're all caught up.</h2>
              <p>Activity notifications can be added next.</p>
            </div>
          </section>
        )}

        {page === "Profile" && (
          <section className="secondary-page">
            <div className="profile-heading">
              <label className="profile-avatar-wrapper" title="Change profile photo">
                <div className="profile-avatar-img">
                  <Avatar name={username} size="large" src={myAvatarUrl} />
                </div>
                <span className="profile-photo-edit">
                  {avatarUploading ? "…" : "✎"}
                </span>
                <input
                  className="profile-photo-input"
                  type="file"
                  accept="image/*"
                  aria-label="Change profile photo"
                  onChange={handleAvatarUpload}
                  disabled={avatarUploading}
                />
              </label>

              <div className="profile-info-block">
                <p className="eyebrow">YOUR SPACE</p>
                <h1>{username}<span className="heading-period">.</span></h1>
                <p className="muted">{user.email}</p>
                <p className="profile-bio">
                  {myProfile?.bio || "Write your story here. ✨"}
                </p>

                <div className="profile-stat-row">
                  <div>
                    <strong>{posts.filter((p) => p.user_id === user.id).length}</strong>
                    <span>Posts</span>
                  </div>
                  <div>
                    <strong>{followerCount}</strong>
                    <span>Followers</span>
                  </div>
                  <div>
                    <strong>{followingCount}</strong>
                    <span>Following</span>
                  </div>
                </div>

                <button
                  className="profile-change-photo"
                  type="button"
                  onClick={() => document.querySelector(".profile-photo-input")?.click()}
                  disabled={avatarUploading}
                >
                  {avatarUploading ? "Uploading photo…" : "Change profile photo"}
                </button>

                <button
                  className="primary-button"
                  type="button"
                  onClick={() => {
                    setUsernameDraft(username);
                    setBio(myProfile?.bio || "");
                    setEditingProfile((prev) => !prev);
                  }}
                >
                  {editingProfile ? "Cancel editing" : "✎ Edit profile"}
                </button>

                {editingProfile && (
                  <form className="profile-edit-form" onSubmit={saveProfile}>
                    <label>
                      Username
                      <input
                        value={usernameDraft}
                        onChange={(e) => setUsernameDraft(e.target.value)}
                        minLength={3}
                        maxLength={24}
                        required
                      />
                    </label>
                    <small>Use 3–24 characters: letters, numbers, dots or underscores.</small>

                    <label>
                      Bio
                      <textarea
                        value={bio}
                        onChange={(e) => setBio(e.target.value)}
                        maxLength={160}
                        placeholder="Write a little about yourself…"
                      />
                    </label>
                    <small>{bio.length}/160</small>

                    <button className="primary-button" disabled={savingProfile}>
                      {savingProfile ? "Saving…" : "Save profile"}
                    </button>
                  </form>
                )}
              </div>
            </div>

            <h2 className="gallery-title">Your posts</h2>
            <div className="explore-grid">
              {posts
                .filter((p) => p.user_id === user.id)
                .map((p) => (
                  <button
                    key={p.id}
                    onClick={() => setPage(p.media_type === "video" ? "Reels" : "Home")}
                  >
                    {p.media_type === "video" ? "▷" : <img src={p.image} alt="" />}
                  </button>
                ))}
            </div>
          </section>
        )}
      </main>

      <nav className="mobile-nav">
        {navItems
          .filter(([name]) =>
            ["Home", "Search", "Create", "Messages", "Profile"].includes(name)
          )
          .map(([name, symbol]) => (
            <button
              key={name}
              className={page === name ? "active" : ""}
              onClick={() => name === "Create" ? setShowCreate(true) : setPage(name)}
            >
              {symbol}
            </button>
          ))}
      </nav>

      {notice && <div className="toast">{notice}</div>}

      {showCreate && (
        <div
          className="modal-backdrop"
          onClick={() => !uploading && setShowCreate(false)}
        >
          <form
            className="create-modal"
            onClick={(e) => e.stopPropagation()}
            onSubmit={createPost}
          >
            <button
              type="button"
              className="modal-close"
              onClick={() => setShowCreate(false)}
            >
              ×
            </button>
            <p className="eyebrow">SHARE A MOMENT</p>
            <h2>Create a post</h2>
            <label className="file-picker">
              Choose photo or video
              <input
                type="file"
                accept="image/*,video/*"
                onChange={(e) => setPostFile(e.target.files?.[0] || null)}
                required
              />
            </label>
            {postFile && (
              <p className="muted">
                {postFile.name} · {(postFile.size / 1024 / 1024).toFixed(1)} MB
              </p>
            )}
            <textarea
              value={postCaption}
              onChange={(e) => setPostCaption(e.target.value)}
              maxLength={2200}
              placeholder="Write a caption…"
            />
            <button className="primary-button" disabled={uploading}>
              {uploading ? "Sharing…" : "Share post"}
            </button>
          </form>
        </div>
      )}

      {selectedStory && (
        <div className="modal-backdrop story-backdrop" onClick={() => setSelectedStory(null)}>
          <div className="story-viewer" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setSelectedStory(null)}>
              ×
            </button>
            <Avatar name={selectedStory.username} size="large" src={selectedStory.avatarUrl} />
            <h2>{selectedStory.username}</h2>
            <p className="muted">
              Stories feature is ready for a future media upload flow.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
