const DEFAULT_TIMEOUT = 15000;

export class BuilderxCmsApi {
  constructor({ baseUrl, token, siteId, cmsApiKey }) {
    this.baseUrl = baseUrl.replace(/\/$/, "");
    this.token = token;
    this.siteId = siteId;
    this.cmsApiKey = cmsApiKey;
  }

  async request(method, path, { body, query } = {}) {
    const url = new URL(`${this.baseUrl}${path}`);
    if (query) {
      for (const [k, v] of Object.entries(query)) {
        if (v != null) url.searchParams.set(k, v);
      }
    }

    const headers = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${this.token}`,
    };

    const res = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(DEFAULT_TIMEOUT),
    });

    const json = await res.json().catch(() => null);
    if (!res.ok) {
      const msg = json?.message || json?.error || res.statusText;
      throw new Error(`API ${res.status}: ${msg}`);
    }
    return json;
  }

  // ── CMS Files ──

  listCmsFiles() {
    return this.request("GET", `/api/v1/dashboard/site/${this.siteId}/cms_files`);
  }

  createCmsFile(params) {
    return this.request("POST", `/api/v1/dashboard/site/${this.siteId}/cms_files`, {
      body: { ...params, token: this.token, x_cms_api_key: this.cmsApiKey },
    });
  }

  updateCmsFile(id, params) {
    return this.request("PATCH", `/api/v1/dashboard/site/${this.siteId}/cms_files/${id}`, {
      body: { ...params, token: this.token, x_cms_api_key: this.cmsApiKey },
    });
  }

  getHttpFunction() {
    return this.request("GET", `/api/v1/dashboard/site/${this.siteId}/cms_files/http_function`);
  }

  createOrUpdateHttpFunction(params) {
    return this.request("POST", `/api/v1/dashboard/site/${this.siteId}/cms_files/http_function`, {
      body: { ...params, token: this.token, x_cms_api_key: this.cmsApiKey },
    });
  }

  debugFunction(params) {
    return this.request("POST", `/api/v1/dashboard/site/${this.siteId}/cms_files/debug`, { body: params });
  }

  runFunction(functionName, method, params) {
    return this.request(method, `/api/v1/${this.siteId}/_functions/${functionName}`, { body: params });
  }

  saveFileVersion(params) {
    return this.request("POST", `/api/v1/dashboard/site/${this.siteId}/cms_files/save_version_file`, { body: params });
  }

  getFileVersions(query) {
    return this.request("GET", `/api/v1/dashboard/site/${this.siteId}/cms_files/version_file`, { query });
  }

  toggleDebugRender(params) {
    return this.request("POST", `/api/v1/dashboard/site/${this.siteId}/cms_files/toggle_is_debug_render`, { body: params });
  }

  // ── Pages ──

  listPages() {
    return this.request("GET", `/api/v1/site/${this.siteId}/pages`);
  }

  createPage(params) {
    return this.request("POST", `/api/v1/site/${this.siteId}/page`, { body: params });
  }

  updatePage(pageId, params) {
    return this.request("POST", `/api/v1/site/${this.siteId}/${pageId}/update_page`, { body: params });
  }

  deletePage(params) {
    return this.request("POST", `/api/v1/site/${this.siteId}/delete_page`, { body: params });
  }

  getPageVersions(pageId) {
    return this.request("GET", `/api/v1/site/${this.siteId}/page_versions/${pageId}`);
  }

  listPageContents(query) {
    return this.request("GET", `/api/v1/site/${this.siteId}/page_contents`, { query });
  }

  updatePageContent(params) {
    return this.request("POST", `/api/v1/site/${this.siteId}/page_contents/page_content`, { body: params });
  }

  listGlobalSections() {
    return this.request("GET", `/api/v1/site/${this.siteId}/global_sections`);
  }

  getPageSource(pageId) {
    return this.request("GET", `/api/v1/site/${this.siteId}/page_source/${pageId}`);
  }

  updatePageSource(pageId, params) {
    return this.request("POST", `/api/v1/site/${this.siteId}/${pageId}/update_page`, { body: params });
  }

  // ── Blog Articles ──

  listArticles(query) {
    return this.request("GET", `/api/v1/cms_function/${this.siteId}/blog/article/all`, { query });
  }

  getArticle(id) {
    return this.request("GET", `/api/v1/cms_function/${this.siteId}/blog/article/${id}`);
  }

  createArticle(params) {
    return this.request("POST", `/api/v1/cms_function/${this.siteId}/blog/article`, { body: params });
  }

  updateArticle(id, params) {
    return this.request("PATCH", `/api/v1/cms_function/${this.siteId}/blog/article/${id}`, { body: params });
  }

  deleteArticle(id) {
    return this.request("DELETE", `/api/v1/cms_function/${this.siteId}/blog/article/${id}`);
  }

  // ── Customers ──

  findCustomerById(id) {
    return this.request("GET", `/api/v1/cms_function/${this.siteId}/customer/identity/${id}`);
  }

  findCustomerByPhone(phone) {
    return this.request("GET", `/api/v1/cms_function/${this.siteId}/customer/phone/${phone}`);
  }

  findCustomerByEmail(email) {
    return this.request("GET", `/api/v1/cms_function/${this.siteId}/customer/email/${email}`);
  }

  // ── Automation ──

  sendMail(params) {
    return this.request("POST", `/api/v1/cms_function/${this.siteId}/application/automation/send_mail`, { body: params });
  }
}
