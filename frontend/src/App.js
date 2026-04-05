import React, { useState, useEffect } from "react";
import Routes from "./routes";
import "react-toastify/dist/ReactToastify.css";

import { createTheme, ThemeProvider } from "@material-ui/core/styles";
import { ptBR } from "@material-ui/core/locale";

const App = () => {
  const [locale, setLocale] = useState();

  const theme = createTheme(
    {
      scrollbarStyles: {
        "&::-webkit-scrollbar": {
          width: "6px",
          height: "6px",
        },
        "&::-webkit-scrollbar-thumb": {
          backgroundColor: "#c1c1c1",
          borderRadius: "10px",
        },
        "&::-webkit-scrollbar-track": {
          backgroundColor: "transparent",
        },
      },
      palette: {
        primary: { main: "#6366f1" },
        secondary: { main: "#8b5cf6" },
        background: {
          default: "#f1f5f9",
          paper: "#ffffff",
        },
      },
      typography: {
        fontFamily: "'Inter', 'Roboto', 'Helvetica', 'Arial', sans-serif",
      },
      shape: {
        borderRadius: 12,
      },
      overrides: {
        MuiPaper: {
          root: {
            boxShadow: "0 1px 3px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.06)",
          },
        },
        MuiTableCell: {
          root: {
            padding: "12px 16px",
          },
        },
      },
    },
    locale
  );

  useEffect(() => {
    const i18nlocale = localStorage.getItem("i18nextLng");
    const browserLocale =
      i18nlocale.substring(0, 2) + i18nlocale.substring(3, 5);

    if (browserLocale === "ptBR") {
      setLocale(ptBR);
    }
  }, []);

  return (
    <ThemeProvider theme={theme}>
      <Routes />
    </ThemeProvider>
  );
};

export default App;
