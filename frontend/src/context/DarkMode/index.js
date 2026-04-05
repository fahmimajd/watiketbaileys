import React, { createContext, useState, useContext, useMemo } from "react";
import PropTypes from "prop-types";
import { createMuiTheme, ThemeProvider as MUIThemeProvider } from "@material-ui/core/styles";
import { CssBaseline } from "@material-ui/core";

const ThemeContext = createContext();

export const ThemeProvider = ({ children }) => {
  const [darkMode, setDarkMode] = useState(() => {
    const saved = localStorage.getItem("darkMode");
    return saved ? JSON.parse(saved) : false;
  });

  const toggleTheme = () => {
    const newMode = !darkMode;
    setDarkMode(newMode);
    localStorage.setItem("darkMode", JSON.stringify(newMode));
  };

  const theme = useMemo(
    () =>
      createMuiTheme({
        palette: {
          type: darkMode ? "dark" : "light",
          primary: { main: "#6366f1" },
          secondary: { main: "#8b5cf6" },
          background: {
            default: darkMode ? "#0f172a" : "#f1f5f9",
            paper: darkMode ? "#1e293b" : "#ffffff",
          },
          ...(darkMode
            ? {
                text: {
                  primary: "#e2e8f0",
                  secondary: "#94a3b8",
                },
              }
            : {}),
        },
        shape: {
          borderRadius: 12,
        },
        scrollbarStyles: {
          "&::-webkit-scrollbar": {
            width: "6px",
            height: "6px",
          },
          "&::-webkit-scrollbar-thumb": {
            backgroundColor: darkMode ? "#475569" : "#c1c1c1",
            borderRadius: "10px",
          },
          "&::-webkit-scrollbar-track": {
            backgroundColor: "transparent",
          },
        },
      }),
    [darkMode]
  );

  const contextValue = useMemo(() => ({ darkMode, toggleTheme }), [darkMode]);

  return (
    <ThemeContext.Provider value={contextValue}>
      <MUIThemeProvider theme={theme}>
        <CssBaseline />
        {children}
      </MUIThemeProvider>
    </ThemeContext.Provider>
  );
};
ThemeProvider.propTypes = {
  children: PropTypes.node.isRequired,
};

export const useThemeContext = () => useContext(ThemeContext);
