export const getJidUser = (jidOrUser: string): string => {
  if (!jidOrUser) {
    return "";
  }

  const atIndex = jidOrUser.indexOf("@");
  const userWithDevice = atIndex > -1 ? jidOrUser.slice(0, atIndex) : jidOrUser;
  const colonIndex = userWithDevice.indexOf(":");
  const withoutDevice = colonIndex > -1 ? userWithDevice.slice(0, colonIndex) : userWithDevice;
  const agentIndex = withoutDevice.indexOf("_");

  return agentIndex > -1 ? withoutDevice.slice(0, agentIndex) : withoutDevice;
};

export const buildJidFromNumber = (value: string, isGroup: boolean): string => {
  const user = getJidUser(value);
  const defaultDomain = isGroup ? "g.us" : "s.whatsapp.net";
  const hasDomain = value.includes("@");

  if (!hasDomain) {
    return `${user}@${defaultDomain}`;
  }

  const providedDomain = value.slice(value.indexOf("@") + 1) || defaultDomain;
  if (isGroup) {
    return `${user}@${providedDomain.endsWith(".g.us") || providedDomain === "g.us" ? providedDomain : "g.us"}`;
  }
  if (providedDomain === "c.us") {
    return `${user}@s.whatsapp.net`;
  }
  return `${user}@${providedDomain || defaultDomain}`;
};
