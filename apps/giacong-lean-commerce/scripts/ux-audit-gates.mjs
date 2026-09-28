function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function isFirstParty(url, baseUrl) {
  try {
    return new URL(url).origin === new URL(baseUrl).origin;
  } catch {
    return false;
  }
}

function isExpectedNavigationAbort(request) {
  if (request.failure !== "net::ERR_ABORTED") return false;
  try {
    const url = new URL(request.url);
    if (request.method === "GET" && url.searchParams.has("_rsc")) return true;
    return request.method === "POST" && url.pathname === "/cdn-cgi/rum";
  } catch {
    return false;
  }
}

function addFirstPartyNetworkFailures(failures, subject, network, baseUrl) {
  for (const response of asArray(network?.badResponses)) {
    if (response.status >= 400 && isFirstParty(response.url, baseUrl)) {
      failures.push({
        code: "first-party-http-error",
        subject,
        detail: `${response.status} ${response.url}`,
      });
    }
  }
  for (const request of asArray(network?.failedRequests)) {
    if (isFirstParty(request.url, baseUrl) && !isExpectedNavigationAbort(request)) {
      failures.push({
        code: "first-party-request-failed",
        subject,
        detail: `${request.method ?? "GET"} ${request.url} (${request.failure ?? "unknown"})`,
      });
    }
  }
  for (const request of asArray(network?.blockedMutations)) {
    failures.push({
      code: "unexpected-blocked-mutation",
      subject,
      detail: `${request.method ?? "mutation"} ${request.url ?? "unknown URL"}`,
    });
  }
}

export function evaluateScrollMotionAudit({ smallViewport, before, during, bottom }) {
  const lazyLoaded = bottom.loadedImageCount > before.loadedImageCount;
  const revealVerified = smallViewport
    ? before.animateCount > 0
      && bottom.animateCount === before.animateCount
      && bottom.animatedCount === before.animatedCount
    : before.animateCount > 0
      && bottom.animatedCount > before.animatedCount
      && (during.sample ?? []).some((sample) => Number(sample.opacity ?? 1) < 1);
  const mode = smallViewport ? "small-viewport-motion-suppressed" : "reveal-enabled";

  return { lazyLoaded, mode, pass: lazyLoaded && revealVerified, revealVerified };
}

function addBrowserFailures(failures, subject, evidence) {
  const pageErrors = asArray(evidence?.pageErrors);
  if (pageErrors.length > 0) {
    failures.push({ code: "page-error", subject, detail: pageErrors.join(" | ") });
  }

  const consoleErrors = asArray(evidence?.consoleErrors).length > 0
    ? evidence.consoleErrors
    : asArray(evidence?.console).filter((entry) => entry.type === "error");
  if (consoleErrors.length > 0) {
    failures.push({
      code: "console-error",
      subject,
      detail: consoleErrors.map((entry) => entry.text ?? String(entry)).join(" | "),
    });
  }
}

export function evaluateUxAudit(audit) {
  const failures = [];
  const incomplete = [];
  const baseUrl = audit.baseUrl;
  const routes = asArray(audit.routes);
  const responsiveSweep = asArray(audit.responsiveSweep);

  if (routes.length === 0) incomplete.push({ code: "no-route-evidence", subject: "routes" });
  if (responsiveSweep.length === 0) incomplete.push({ code: "no-responsive-evidence", subject: "responsiveSweep" });

  for (const route of routes) {
    const subject = route.name ?? route.route ?? "unnamed route";
    if (!Number.isInteger(route.status) || route.status < 200 || route.status >= 300) {
      failures.push({ code: "route-http-status", subject, detail: String(route.status ?? "missing") });
    }
    for (const action of asArray(route.actions)) {
      if (action.pass !== true) {
        failures.push({ code: "failed-action", subject, detail: action.id ?? "unnamed action" });
      }
    }
    for (const note of asArray(route.notes)) {
      if (String(note).startsWith("runner error:")) {
        failures.push({ code: "runner-error", subject, detail: String(note) });
      }
    }
    addBrowserFailures(failures, subject, route);
    addFirstPartyNetworkFailures(failures, subject, route.network, baseUrl);

    if (route.inspection?.horizontalOverflow === true) {
      failures.push({ code: "horizontal-overflow", subject });
    } else if (!route.inspection) {
      incomplete.push({ code: "missing-page-inspection", subject });
    }

    const axe = route.accessibility?.axe;
    if (!axe?.available) {
      incomplete.push({ code: "axe-unavailable", subject, detail: axe?.error ?? "No axe result" });
    } else {
      const seriousViolations = asArray(axe.violations).filter((violation) => (
        violation.impact === "critical" || violation.impact === "serious"
      ));
      for (const violation of seriousViolations) {
        failures.push({
          code: "serious-accessibility-violation",
          subject,
          detail: `${violation.id}: ${violation.help ?? "no description"}`,
        });
      }
    }
  }

  for (const sweep of responsiveSweep) {
    const subject = `responsive ${sweep.viewport?.width ?? "?"}x${sweep.viewport?.height ?? "?"}`;
    if (!Number.isInteger(sweep.status) || sweep.status < 200 || sweep.status >= 300) {
      failures.push({ code: "responsive-http-status", subject, detail: String(sweep.status ?? "missing") });
    }
    if (asArray(sweep.errors).length > 0) {
      failures.push({ code: "responsive-runner-error", subject, detail: asArray(sweep.errors).join(" | ") });
    }
    addBrowserFailures(failures, subject, sweep);
    addFirstPartyNetworkFailures(failures, subject, sweep.network, baseUrl);
    if (sweep.horizontalOverflow === true) failures.push({ code: "horizontal-overflow", subject });
  }

  const status = failures.length > 0 ? "failed" : incomplete.length > 0 ? "incomplete" : "passed";
  return {
    status,
    exitCode: status === "failed" ? 1 : status === "incomplete" ? 2 : 0,
    failures,
    incomplete,
  };
}
