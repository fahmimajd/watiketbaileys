import { useState, useEffect } from "react";
import api from "../../services/api";
import toastError from "../../errors/toastError";

const useDashboardMetrics = () => {
  const [loading, setLoading] = useState(true);
  const [operators, setOperators] = useState([]);

  useEffect(() => {
    setLoading(true);
    const fetchMetrics = async () => {
      try {
        const { data } = await api.get("/dashboard/metrics");
        setOperators(data.operators);
        setLoading(false);
      } catch (err) {
        setLoading(false);
        toastError(err);
      }
    };

    fetchMetrics();
  }, []);

  return { operators, loading };
};

export default useDashboardMetrics;
