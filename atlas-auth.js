(() => {
  const SUPABASE_URL = "https://oorpvbxxpbxoaaykrtcf.supabase.co";
  const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_5261il-Rwu1wPQG_sTBb5g_tE52L_DQ";
  const EDGE_USERS_URL = SUPABASE_URL + "/functions/v1/atlas-users";

  const sb = window.supabase?.createClient?.(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
  });

  if (!sb) {
    console.error("Supabase SDK indisponível.");
    return;
  }

  let currentProfile = null;

  function qs(id) { return document.getElementById(id); }
  function roleLabel(role) {
    return ({admin:"Administrador",operacao:"Legalização / Operação",financeiro:"Financeiro",cliente:"Cliente",auditoria:"Auditoria"})[role] || role || "Usuário";
  }
  function message(el, text, kind="info") {
    if (!el) return;
    el.textContent = text || "";
    el.className = "auth-message" + (text ? " " + kind : " hidden");
  }
  function showAuthView(name) {
    ["login","bootstrap","reset","new-password"].forEach(v => {
      qs("auth-" + v + "-view")?.classList.toggle("hidden", v !== name);
    });
  }
  function setBusy(btn, busy, text, idle) {
    if (!btn) return;
    btn.disabled = !!busy;
    btn.textContent = busy ? text : idle;
  }
  function friendlyError(err) {
    const raw = String(err?.message || err || "");
    if (/Invalid login credentials/i.test(raw)) return "E-mail ou senha inválidos.";
    if (/Email not confirmed/i.test(raw)) return "Confirme seu e-mail antes de entrar.";
    if (/User already registered/i.test(raw)) return "Já existe uma conta com este e-mail.";
    if (/Password should be/i.test(raw)) return "A senha não atende aos requisitos mínimos.";
    if (/INVALID_OR_CLOSED_BOOTSTRAP/i.test(raw)) return "Código de implantação inválido ou primeira ativação já concluída.";
    if (/CREATE_USER_FAILED/i.test(raw)) return "Não foi possível criar o usuário.";
    return raw || "Não foi possível concluir a operação.";
  }

  async function loadProfile(userId) {
    const { data, error } = await sb
      .from("profiles")
      .select("id, organization_id, full_name, role, active, client_id")
      .eq("id", userId)
      .maybeSingle();
    if (error) throw error;
    return data;
  }

  async function handleSession(session) {
    if (!session?.user) {
      currentProfile = null;
      window.hideAtlasApp?.();
      qs("login-screen")?.classList.remove("hidden");
      qs("app-shell")?.classList.add("hidden");
      return;
    }

    try {
      const profile = await loadProfile(session.user.id);
      if (!profile) {
        await sb.auth.signOut();
        message(qs("login-message"), "Sua conta existe, mas ainda não possui perfil autorizado no ATLAS. Procure o Administrador.", "error");
        return;
      }
      if (!profile.active) {
        await sb.auth.signOut();
        message(qs("login-message"), "Este acesso está desativado. Procure o Administrador.", "error");
        return;
      }
      currentProfile = profile;
      qs("login-screen")?.classList.add("hidden");
      window.showApp?.(profile);
    } catch (err) {
      console.error(err);
      message(qs("login-message"), "Não foi possível carregar as permissões da conta.", "error");
    }
  }

  async function refreshBootstrapStatus() {
    try {
      const { data, error } = await sb.rpc("atlas_bootstrap_status");
      if (error) throw error;
      const available = !!data?.available;
      qs("first-access-btn")?.classList.toggle("hidden", !available);
      const dot = qs("auth-status-dot");
      const label = qs("auth-status-text");
      if (dot) dot.classList.toggle("ok", true);
      if (label) label.textContent = available ? "Ambiente conectado · aguardando primeira ativação" : "Ambiente conectado · autenticação ativa";
    } catch (err) {
      console.error(err);
      const label = qs("auth-status-text");
      if (label) label.textContent = "Falha ao validar o ambiente de autenticação";
    }
  }

  async function adminRequest(payload) {
    const { data: { session } } = await sb.auth.getSession();
    if (!session?.access_token) throw new Error("Sessão expirada.");
    const res = await fetch(EDGE_USERS_URL, {
      method: "POST",
      headers: {
        "Content-Type":"application/json",
        "apikey": SUPABASE_PUBLISHABLE_KEY,
        "Authorization":"Bearer " + session.access_token
      },
      body: JSON.stringify(payload)
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data?.detail || data?.error || "Falha na administração de usuários.");
    return data;
  }

  async function bootstrapRequest(payload) {
    const res = await fetch(EDGE_USERS_URL, {
      method:"POST",
      headers:{ "Content-Type":"application/json", "apikey":SUPABASE_PUBLISHABLE_KEY },
      body: JSON.stringify({ action:"bootstrap", ...payload })
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data?.detail || data?.error || "Falha na primeira ativação.");
    return data;
  }

  function bindPasswordToggles() {
    document.querySelectorAll("[data-toggle-password]").forEach(btn => {
      btn.addEventListener("click", () => {
        const input = qs(btn.dataset.togglePassword);
        if (!input) return;
        input.type = input.type === "password" ? "text" : "password";
        btn.textContent = input.type === "password" ? "◉" : "◌";
      });
    });
  }

  async function init() {
    bindPasswordToggles();

    document.querySelectorAll("[data-auth-view]").forEach(btn => {
      btn.addEventListener("click", () => showAuthView(btn.dataset.authView));
    });
    qs("first-access-btn")?.addEventListener("click", () => showAuthView("bootstrap"));
    qs("forgot-password-btn")?.addEventListener("click", () => showAuthView("reset"));
    qs("logout-btn")?.addEventListener("click", async () => {
      await sb.auth.signOut();
      currentProfile = null;
      showAuthView("login");
      window.hideAtlasApp?.();
    });

    qs("login-form")?.addEventListener("submit", async (e) => {
      e.preventDefault();
      const email = qs("login-email").value.trim();
      const password = qs("login-password").value;
      const btn = qs("login-submit");
      message(qs("login-message"), "");
      setBusy(btn, true, "Entrando...", "Entrar no ATLAS");
      const { data, error } = await sb.auth.signInWithPassword({ email, password });
      setBusy(btn, false, "Entrando...", "Entrar no ATLAS");
      if (error) return message(qs("login-message"), friendlyError(error), "error");
      await handleSession(data.session);
    });

    qs("bootstrap-form")?.addEventListener("submit", async (e) => {
      e.preventDefault();
      const fullName = qs("bootstrap-name").value.trim();
      const email = qs("bootstrap-email").value.trim();
      const password = qs("bootstrap-password").value;
      const confirm = qs("bootstrap-confirm").value;
      const code = qs("bootstrap-code").value.trim().toUpperCase();
      const btn = qs("bootstrap-submit");
      message(qs("bootstrap-message"), "");
      if (password !== confirm) return message(qs("bootstrap-message"), "As senhas não coincidem.", "error");
      if (password.length < 10) return message(qs("bootstrap-message"), "A senha deve ter ao menos 10 caracteres.", "error");
      setBusy(btn, true, "Criando Administrador...", "Criar Administrador");
      try {
        await bootstrapRequest({ fullName, email, password, code });
        const { data, error } = await sb.auth.signInWithPassword({ email, password });
        if (error) throw error;
        message(qs("bootstrap-message"), "Administrador criado com sucesso.", "success");
        await refreshBootstrapStatus();
        await handleSession(data.session);
      } catch (err) {
        message(qs("bootstrap-message"), friendlyError(err), "error");
      } finally {
        setBusy(btn, false, "Criando Administrador...", "Criar Administrador");
      }
    });

    qs("reset-form")?.addEventListener("submit", async (e) => {
      e.preventDefault();
      const email = qs("reset-email").value.trim();
      message(qs("reset-message"), "");
      const redirectTo = window.location.origin + window.location.pathname;
      const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo });
      if (error) return message(qs("reset-message"), friendlyError(error), "error");
      message(qs("reset-message"), "Se o e-mail estiver cadastrado, as instruções de recuperação foram enviadas.", "success");
    });

    qs("new-password-form")?.addEventListener("submit", async (e) => {
      e.preventDefault();
      const password = qs("new-password").value;
      const confirm = qs("new-password-confirm").value;
      if (password !== confirm) return message(qs("new-password-message"), "As senhas não coincidem.", "error");
      if (password.length < 10) return message(qs("new-password-message"), "A senha deve ter ao menos 10 caracteres.", "error");
      const { error } = await sb.auth.updateUser({ password });
      if (error) return message(qs("new-password-message"), friendlyError(error), "error");
      message(qs("new-password-message"), "Senha atualizada. Você já pode usar o sistema.", "success");
      setTimeout(() => showAuthView("login"), 1000);
    });

    sb.auth.onAuthStateChange(async (event, session) => {
      if (event === "PASSWORD_RECOVERY") {
        qs("login-screen")?.classList.remove("hidden");
        qs("app-shell")?.classList.add("hidden");
        showAuthView("new-password");
        return;
      }
      if (event === "SIGNED_OUT") {
        currentProfile = null;
        qs("login-screen")?.classList.remove("hidden");
        qs("app-shell")?.classList.add("hidden");
        showAuthView("login");
      }
    });

    await refreshBootstrapStatus();
    const { data: { session } } = await sb.auth.getSession();
    if (session) await handleSession(session);
    else {
      qs("login-screen")?.classList.remove("hidden");
      qs("app-shell")?.classList.add("hidden");
      showAuthView("login");
    }
  }

  window.atlasAuth = {
    client: sb,
    adminRequest,
    getProfile: () => currentProfile,
    roleLabel,
    signOut: () => sb.auth.signOut()
  };

  init();
})();