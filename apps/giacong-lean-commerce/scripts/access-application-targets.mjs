export function classifyAccessApplications(applications, targetDomain) {
  const target = normalizeHostname(targetDomain);
  const exactApps = [];
  const relatedApps = [];

  for (const app of applications ?? []) {
    const targetSet = effectiveTargets(app);
    const publicScopes = targetSet.scopes.map(parsePublicScope).filter(Boolean);
    const allScopesStayOnTarget = publicScopes.length > 0
      && publicScopes.every((scope) => scope.hostname === target && !scope.hostname.includes("*"));
    const coversWholeTargetHost = publicScopes.some(
      (scope) => scope.hostname === target && !scope.hostname.includes("*") && isWholeHostPath(scope.path),
    );
    const exactTargetOnly = allScopesStayOnTarget
      && coversWholeTargetHost
      && !targetSet.hasOtherDestinationKinds;

    if (exactTargetOnly) {
      exactApps.push(app);
      continue;
    }

    if (publicScopes.some((scope) => hostnamePatternCovers(scope.hostname, target))) {
      relatedApps.push({ app, targets: targetSet.rawTargets });
    }
  }

  return { exactApps, relatedApps };
}

export function formatRelatedAccessApps(relatedApps) {
  return relatedApps.map(({ app, targets }) => {
    const identity = [app?.name, app?.id].filter(Boolean).join(" / ") || "unnamed-app";
    const renderedTargets = targets.length > 0 ? targets.join(", ") : "unreported-targets";
    return `${identity}: ${renderedTargets}`;
  }).join(" | ");
}

function effectiveTargets(app) {
  if (Array.isArray(app?.destinations) && app.destinations.length > 0) {
    const rawTargets = [];
    let hasOtherDestinationKinds = false;

    for (const destination of app.destinations) {
      const isPublic = (destination?.type === undefined || destination?.type === "public")
        && typeof destination?.uri === "string";
      if (isPublic) rawTargets.push(destination.uri);
      else hasOtherDestinationKinds = true;
    }

    return { scopes: rawTargets, rawTargets, hasOtherDestinationKinds };
  }

  if (Array.isArray(app?.self_hosted_domains) && app.self_hosted_domains.length > 0) {
    const rawTargets = app.self_hosted_domains.filter((value) => typeof value === "string");
    return { scopes: rawTargets, rawTargets, hasOtherDestinationKinds: false };
  }

  const rawTargets = typeof app?.domain === "string" ? [app.domain] : [];
  return { scopes: rawTargets, rawTargets, hasOtherDestinationKinds: false };
}

function parsePublicScope(value) {
  if (typeof value !== "string") return null;
  let scope = value.trim().toLowerCase();
  if (!scope) return null;

  scope = scope.replace(/^https?:\/\//, "");
  const queryIndex = scope.search(/[?#]/);
  if (queryIndex >= 0) scope = scope.slice(0, queryIndex);

  const slashIndex = scope.indexOf("/");
  const hostname = slashIndex >= 0 ? scope.slice(0, slashIndex) : scope;
  const path = slashIndex >= 0 ? scope.slice(slashIndex) : "";
  if (!hostname) return null;

  return { hostname, path };
}

function normalizeHostname(value) {
  return String(value ?? "").trim().toLowerCase().replace(/\.$/, "");
}

function isWholeHostPath(path) {
  return path === "" || path === "/" || path === "/*";
}

function hostnamePatternCovers(pattern, target) {
  if (pattern === target) return true;
  if (!pattern.includes("*")) return false;

  const escaped = pattern
    .split("*")
    .map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    .join("[^.]+");
  return new RegExp(`^${escaped}$`, "i").test(target);
}
