import {
  collection,
  addDoc,
  onSnapshot,
  updateDoc,
  deleteDoc,
  doc,
  query,
  where,
  setDoc,
  getDoc,
} from "firebase/firestore";
import { useState, useEffect } from "react";
import "./App.css";
import { db } from "./firebase";

const cleanPhone = (phone) => {
  if (!phone) return "";
  return String(phone).replace(/\D/g, "");
};

const formatPhone = (phone) => {
  const p = cleanPhone(phone);

  if (p.length !== 11) return phone;

  return p.replace(/^(\d{2})(\d{5})(\d{4})$/, "($1) $2-$3");
};

const sports = [
  "Vôlei",
  "Futevôlei",
  "Beach Tênis",
  "Futmesa",
  "Treino",
  "Outro",
];

const generateHours = () => {
  let hours = [];
  for (let h = 6; h < 24; h++) {
    hours.push(`${String(h).padStart(2, "0")}:00`);
    hours.push(`${String(h).padStart(2, "0")}:30`);
  }
  hours.push("00:00");
  return hours;
};

const formatDateBR = (date) => {
  if (!date) return "-"; // 🔥 EVITA ERRO

  const [y, m, d] = date.split("-");
  return `${d}/${m}/${y}`;
};

const hourToNumber = (hour) => {
  const [h, m] = hour.split(":").map(Number);
  let value = h + m / 60;
  if (h === 0) value = 24;
  return value;
};

const safeArray = (arr) => (Array.isArray(arr) ? arr : []);

export default function App() {
  // ✅ STATES PRIMEIRO (OBRIGATÓRIO)

  const [selectedClient, setSelectedClient] = useState(null);

  const [calendarDate, setCalendarDate] = useState("");
  const [logo, setLogo] = useState(null);
  const [pixKey, setPixKey] = useState("");
  const [accountName, setAccountName] = useState("");
  const [bank, setBank] = useState("");
  const getSavedUser = () => {
    const saved = localStorage.getItem("user");
    return saved ? JSON.parse(saved) : { name: "", phone: "" };
  };

  const [user, setUser] = useState(getSavedUser);
  const [tempUser, setTempUser] = useState(getSavedUser);

  const activeClient = selectedClient || user;

  const ADMIN = {
    name: "CSM ARENA",
    phone: "99981392039",
  };

  const isAdmin = user.name === ADMIN.name || user.phone === ADMIN.phone;

  const [search, setSearch] = useState("");
  const [reservations, setReservations] = useState([]);

  const [clients, setClients] = useState([]);
  const [newClient, setNewClient] = useState({ name: "", phone: "" });
  const [deletedReservations, setDeletedReservations] = useState([]);
  const [restoringIds, setRestoringIds] = useState([]);
  const [editingPhone, setEditingPhone] = useState(null);
  const [editData, setEditData] = useState({ name: "", phone: "" });

  const getSavedPage = () => localStorage.getItem("page") || "home";
  const getSavedStep = () => Number(localStorage.getItem("step")) || 1;
  const getSavedAdminPage = () => localStorage.getItem("adminPage") || "menu";

  const [page, setPage] = useState(getSavedPage);
  const [step, setStep] = useState(getSavedStep);
  const [adminPage, setAdminPage] = useState(getSavedAdminPage);

  const getSavedBooking = () => {
    const saved = localStorage.getItem("booking");
    return saved ? JSON.parse(saved) : { sport: "", date: "", hours: [] };
  };

  const [booking, setBooking] = useState(getSavedBooking);

  // ✅ AGORA SIM os useEffect

  useEffect(() => {
    localStorage.setItem("booking", JSON.stringify(booking));
  }, [booking]);

  useEffect(() => {
    localStorage.setItem("page", page);
  }, [page]);

  useEffect(() => {
    localStorage.setItem("step", step);
  }, [step]);

  useEffect(() => {
    localStorage.setItem("adminPage", adminPage);
  }, [adminPage]);

  useEffect(() => {
    if (page === "booking" && step > 1 && !booking.date) {
      setStep(1);
    }
  }, [page]);

  useEffect(() => {
    const q = collection(db, "reservas");

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const lista = snapshot.docs.map((docSnap) => {
        const data = docSnap.data();

        return {
          id: docSnap.id,
          ...data,
          hours: Array.isArray(data.hours) ? data.hours : [],
        };
      });

      setReservations(lista);
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const q = collection(db, "lixeira");

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const lista = snapshot.docs.map((docSnap) => {
        const data = docSnap.data();

        return {
          ...data,
          firestoreId: docSnap.id,
        };
      });

      setDeletedReservations(lista);
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      const now = new Date();

      setReservations((prev) =>
        prev.filter((r) => {
          if (r.status !== "pendente") return true;

          const created = new Date(r.createdAt);
          const diffMinutes = (now - created) / (1000 * 60);

          return diffMinutes < 3;
        }),
      );
    }, 10000);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!user || (!isAdmin && !user.phone)) return;

    let q;

    if (isAdmin) {
      q = collection(db, "clients");
    } else {
      q = query(
        collection(db, "clients"),
        where("phone", "==", cleanPhone(user.phone)),
      );
    }

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const lista = snapshot.docs.map((doc) => {
        const d = doc.data();

        return {
          id: doc.id,
          ...d,
          hours: safeArray(d.hours),
        };
      });

      setClients(lista);
    });

    return () => unsubscribe();
  }, [user, isAdmin]);

  useEffect(() => {
    localStorage.removeItem("reservations");
  }, []);

  useEffect(() => {
    const savedUser = localStorage.getItem("user");
    const savedLogo = localStorage.getItem("logo");
    const savedClients = localStorage.getItem("clients"); // ✅ AQUI

    if (savedUser) {
      const parsedUser = JSON.parse(savedUser);
      setUser(parsedUser);
      setTempUser(parsedUser);
    }

    if (savedLogo) setLogo(savedLogo);
  }, []);

  useEffect(() => {
  const carregarPix = async () => {
    const docRef = doc(db, "config", "pix");
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      const data = docSnap.data();
      setPixKey(data.pixKey || "");
      setAccountName(data.accountName || "");
      setBank(data.bank || "");
    }
  };

  carregarPix();
}, []);
  
  useEffect(() => {
    const q = query(collection(db, "config"), where("type", "==", "logo"));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      if (!snapshot.empty) {
        const lastLogo = snapshot.docs[snapshot.docs.length - 1].data().value;
        setLogo(lastLogo);
      }
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    localStorage.setItem("user", JSON.stringify(user));
  }, [user]);

  useEffect(() => {
    if (logo) {
      localStorage.setItem("logo", logo);
    }
  }, [logo]);

  useEffect(() => {
    const interval = setInterval(async () => {
      const expiradas = reservations.filter(
        (r) =>
          r.status === "pendente" && r.expiresAt && Date.now() > r.expiresAt,
      );

      try {
        await Promise.all(
          expiradas
            .filter((r) => r.id)
            .map((r) =>
              updateDoc(doc(db, "reservas", r.id), {
                status: "expirada",
              }),
            ),
        );
      } catch (error) {
        console.error("Erro ao expirar:", error);
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [reservations]);

  useEffect(() => {
    const interval = setInterval(async () => {
      for (let r of reservations) {
        if (r.status === "ativa" && isFinished(r)) {
          try {
            if (!r?.id) return;
            await updateDoc(doc(db, "reservas", r.id), {
              status: "concluída",
            });
          } catch (error) {
            console.error("Erro ao concluir:", error);
          }
        }
      }
    }, 10000);

    return () => clearInterval(interval);
  }, [reservations]);

  const [showClients, setShowClients] = useState(false);

  const [paymentTime, setPaymentTime] = useState(300); // 5 minutos
  const [confirmEnabled, setConfirmEnabled] = useState(false);
  const hours = generateHours();

  const isPastHour = (hour) => {
    if (!booking.date) return false;
    if (hour === "00:00") return false;

    const now = new Date();
    const todayStr = new Date().toLocaleDateString("sv-SE");

    if (booking.date !== todayStr) return false;

    const [h, m] = hour.split(":");

    if (parseInt(h) < now.getHours()) return true;
    if (parseInt(h) === now.getHours() && parseInt(m) <= now.getMinutes())
      return true;

    return false;
  };

  const isBooked = (hour) => {
    let startCount = 0;
    let endCount = 0;

    for (let r of reservations) {
      const invalidStatus = ["cancelada", "expirada"];

      if (
        r.date !== booking.date ||
        invalidStatus.includes(r.status) ||
        !r.hours ||
        r.hours.length === 0
      )
        continue;

      const sorted = [...(Array.isArray(r.hours) ? r.hours : [])].sort(
        (a, b) => hourToNumber(a) - hourToNumber(b),
      );

      const start = sorted[0];
      const end = sorted[sorted.length - 1];

      if (!start || !end) continue;

      const hNum = hourToNumber(hour);
      const startNum = hourToNumber(start);
      const endNum = hourToNumber(end);

      if (hNum > startNum && hNum < endNum) return true;

      if (start && hour === start) startCount++;
      if (end && hour === end) endCount++;
    }

    if (hour === "00:00" || hour === "06:00") {
      if (startCount > 0 || endCount > 0) return true;
    }

    if (startCount > 0 && endCount > 0) return true;

    return false;
  };

  const toggleHour = (h) => {
    if (isPastHour(h) || isBooked(h)) return;

    const current = Array.isArray(booking.hours) ? booking.hours : [];

    if (current.includes(h)) {
      setBooking({
        ...booking,
        hours: current.filter((x) => x !== h),
      });
    } else {
      setBooking({
        ...booking,
        hours: [...current, h].sort(
          (a, b) => hourToNumber(a) - hourToNumber(b),
        ),
      });
    }
  };

  const calcDuration = (hoursList = []) => {
    if (!Array.isArray(hoursList) || hoursList.length <= 1) return 0.5;
    return (hoursList.length - 1) * 0.5;
  };

  const calcPrice = (hoursList = []) => {
    if (!Array.isArray(hoursList) || hoursList.length === 0) return "";

    const sorted = [...hoursList].sort(
      (a, b) => hourToNumber(a) - hourToNumber(b),
    );

    const duration = calcDuration(hoursList);

    const startHour = hourToNumber(sorted[0]);
    const endHour = hourToNumber(sorted[sorted.length - 1]);

    if (startHour < 18 && endHour > 18) {
      return "Valor negociado (tarde/noite)";
    }

    if (startHour >= 18) {
      const total = duration * 50;
      return `R$ ${total.toFixed(2)}`;
    }

    if (endHour <= 18) {
      return duration <= 2 ? "R$ 5,00 por pessoa" : "R$ 10,00 por pessoa";
    }

    return "";
  };
  const isFinished = (r) => {
    // 🔥 GARANTE ARRAY SEMPRE
    const hours = Array.isArray(r.hours) ? r.hours : [];

    // 🔥 se não tiver horário, não finaliza
    if (hours.length === 0) return false;

    const lastHour = hours[hours.length - 1];

    // 🔥 segurança extra
    if (!lastHour) return false;

    const reservaDateTime = new Date(r.date + "T" + lastHour);
    const now = new Date();

    return now > reservaDateTime;
  };

  const sortedReservations = [...reservations].sort((a, b) => {
    const aHours = Array.isArray(a.hours) ? a.hours : [];
    const bHours = Array.isArray(b.hours) ? b.hours : [];

    const dateA = new Date(a.date + "T" + (aHours[0] || "00:00"));
    const dateB = new Date(b.date + "T" + (bHours[0] || "00:00"));

    return dateA - dateB;
  });

  // 🔥 ADICIONE ISSO AQUI
  const clientsMap = {};

  clients.forEach((c) => {
    const phone = cleanPhone(c.phone);

    clientsMap[phone] = {
      ...c,
      phone,
    };
  });

  reservations.forEach((r) => {
    const phone = cleanPhone(r.phone);

    if (!clientsMap[phone]) {
      clientsMap[phone] = {
        id: phone,
        name: r.name,
        phone,
      };
    }
  });

  const allClients = Object.values(clientsMap);

  const emptyTrash = async () => {
    if (!window.confirm("Tem certeza que deseja excluir TUDO da lixeira?"))
      return;

    try {
      await Promise.all(
        deletedReservations.map((item) =>
          deleteDoc(doc(db, "lixeira", item.firestoreId)),
        ),
      );

      setDeletedReservations([]);
    } catch (error) {
      console.error("Erro ao esvaziar lixeira:", error);
    }
  };

  const Button = ({ text, onClick, type = "primary", active }) => (
    <button
      className={`btn ${type} ${active ? "active" : ""}`}
      onClick={onClick}
    >
      {text}
    </button>
  );
  useEffect(() => {
    if (page !== "payment") return;

    if (paymentTime <= 0) return;

    const timer = setInterval(() => {
      setPaymentTime((prev) => prev - 1);
    }, 1000);

    return () => clearInterval(timer);
  }, [page, paymentTime]);

  useEffect(() => {
    if (page === "payment") {
      const unlock = setTimeout(() => {
        setConfirmEnabled(true);
      }, 60000); // 1 minuto

      return () => clearTimeout(unlock);
    }
  }, [page]);
  const Back = () => {
    if (page === "booking" && step > 1) {
      return (
        <button className="back" onClick={() => setStep(step - 1)}>
          ← Voltar
        </button>
      );
    }

    if (page === "admin" && adminPage !== "menu") {
      return (
        <button className="back" onClick={() => setAdminPage("menu")}>
          ← Voltar
        </button>
      );
    }

    return (
      <button className="back" onClick={() => setPage("home")}>
        ← Voltar
      </button>
    );
  };

  // ================= ADMIN =================
  if (page === "admin") {
    if (adminPage === "menu") {
      return (
        <div
  className="container"
  style={{
    width: "100%",
    maxWidth: "500px",
    margin: "0 auto",
    padding: "10px",
    overflow: "hidden",
  }}
>
          <Back />
          <h2>ADMINISTRAÇÃO</h2>
          <button
            onClick={() => setAdminPage("trash")}
            style={{
              position: "absolute",
              top: "20px",
              right: "20px",
              background: "transparent",
              border: "none",
              fontSize: "20px",
              cursor: "pointer",
            }}
          >
            🗑️
          </button>

          <Button
            text="📅 Calendário"
            onClick={() => setAdminPage("calendar")}
          />
          <Button text="📋 Agendamentos" onClick={() => setAdminPage("list")} />
          <Button text="👥 Clientes" onClick={() => setAdminPage("clients")} />
          <Button text="💰 Pagamento" onClick={() => setAdminPage("payment")} />
          <Button
            text="➕ Novo Agendamento"
            onClick={() => {
              setPage("booking");
              setStep(2);
            }}
          />
        </div>
      );
    }

    if (adminPage === "calendar") {
      return (
        <div
  className="container"
  style={{
    maxWidth: "500px",
    width: "100%",
    margin: "0 auto",
    padding: "10px",
  }}
>
          <Back />
          <h2>CALENDÁRIO</h2>

          <input
            type="date"
            onChange={(e) => setCalendarDate(e.target.value)}
          />

          {calendarDate &&
            hours.map((h) => {
              const reserva = reservations.find(
                (r) =>
                  r.date === calendarDate &&
                  (Array.isArray(r.hours) ? r.hours : []).includes(h) &&
                  r.status !== "cancelada" &&
                  r.status !== "expirada",
              );

              return (
                <div
                  key={h}
                  className="card"
                  style={{ background: reserva ? "#fff" : "#bbb" }}
                >
                  <b>{h}</b>
                  {reserva && (
                    <p>
                      {reserva.sport} - {reserva.name}
                    </p>
                  )}
                </div>
              );
            })}
        </div>
      );
    }

    if (adminPage === "list") {
      return (
        <div
  className="container"
  style={{
    maxWidth: "500px",
    width: "100%",
    margin: "0 auto",
    padding: "10px",
  }}
>
          <Back />
          <h2>AGENDAMENTOS</h2>

          {sortedReservations
            .filter((r) => r.status !== "expirada")
            .map((r, i) => (
              <div key={i} className="card" style={{ position: "relative" }}>
                <button
                  onClick={async () => {
                    if (
                      window.confirm(
                        "Tem certeza que deseja excluir definitivamente esse registro?",
                      )
                    ) {
                      try {
                        // 🔥 1. SALVA NA LIXEIRA (FIREBASE - CORRETO)
                        await addDoc(collection(db, "lixeira"), {
                          ...r,
                          firestoreId: r.id,
                          type: "reserva",
                          deletedAt: Date.now(),
                        });

                        await deleteDoc(doc(db, "reservas", r.id));

                        // 🔥 REMOVE IMEDIATO DA TELA
                        setReservations((prev) =>
                          prev.filter((item) => item.id !== r.id),
                        );
                      } catch (error) {
                        console.error("Erro ao excluir:", error);
                      }
                    }
                  }}
                  style={{
                    position: "absolute",
                    top: "10px",
                    right: "10px",
                    background: "transparent",
                    border: "none",
                    fontSize: "16px",
                    cursor: "pointer",
                  }}
                >
                  ✖
                </button>
                <p>
                  <b>Cliente:</b> {r.name}
                </p>
                <p>
                  <b>Telefone:</b> {formatPhone(r.phone)}
                </p>
                <p>
                  <b>Esporte:</b> {r.sport}
                </p>
                <p>
                  <b>Data:</b> {formatDateBR(r.date)}
                </p>
                <p>
                  <b>Horário:</b>{" "}
                  {(Array.isArray(r.hours) ? r.hours : []).join(", ")}
                </p>
                <p>
                  <b>Duração:</b>{" "}
                  {calcDuration(Array.isArray(r.hours) ? r.hours : [])}h
                </p>
                <p>
                  <b>Valor:</b>{" "}
                  {calcPrice(Array.isArray(r.hours) ? r.hours : [])}
                </p>
                <p>
                  <b>Status:</b>{" "}
                  <span
                    style={{
                      color:
                        r.status === "concluída"
                          ? "green"
                          : r.status === "cancelada"
                            ? "red"
                            : "black",
                      fontWeight: "bold",
                    }}
                  >
                    {r.status}
                  </span>
                </p>
                {r.status !== "cancelada" && (
                  <Button
                    text="Cancelar"
                    type="secondary"
                    onClick={async () => {
                      if (window.confirm("Cancelar reserva?")) {
                        try {
                          await updateDoc(doc(db, "reservas", r.id), {
                            status: "cancelada",
                          });
                        } catch (error) {
                          console.error("Erro ao cancelar:", error);
                        }
                      }
                    }}
                  />
                )}
              </div>
            ))}
        </div>
      );
    }

    if (adminPage === "clients") {
      const clientsMap = {};

      // 🔹 clientes cadastrados manualmente
      clients.forEach((c) => {
        const phone = cleanPhone(c.phone);

        clientsMap[phone] = {
          ...c,
          phone,
          total: 0,
          active: 0,
        };
      });

      // 🔹 clientes vindos das reservas
      reservations.forEach((r) => {
        const phone = cleanPhone(r.phone);

        if (!clientsMap[phone]) {
          clientsMap[phone] = {
            name: r.name,
            phone,
            total: 0,
            active: 0,
          };
        }

        if (r.status === "ativa" || r.status === "concluída") {
          clientsMap[phone].total++;
        }

        if (r.status === "ativa") {
          clientsMap[phone].active++;
        }
      });

      return (
        <div
  className="container"
  style={{
    width: "100%",
    maxWidth: "500px",
    margin: "0 auto",
    padding: "10px",
    overflow: "hidden",
  }}
>
          <Back />
          <h2>CLIENTES</h2>

          <Button
            text="➕ Adicionar Cliente"
            onClick={() => setAdminPage("addClient")}
          />

          {Object.values(clientsMap)
            .sort((a, b) => a.name.localeCompare(b.name))
            .map((c, i) => (
              <div
                key={i}
                className="card"
                style={{
                  position: "relative",
                  background: "#fff",
                  textAlign: "left",
                  padding: "15px",
                  borderRadius: "10px",
                }}
              >
                <button
                  onClick={async () => {
                    if (
                      window.confirm("Excluir cliente e TODAS as reservas?")
                    ) {
                      try {
                        const toDelete = reservations.filter(
                          (r) => cleanPhone(r.phone) === cleanPhone(c.phone),
                        );

                        // 🔥 1. SALVA O CLIENTE NA LIXEIRA
                        await addDoc(collection(db, "lixeira"), {
                          ...c,
                          firestoreId: c.id,
                          type: "cliente",
                          deletedAt: Date.now(),
                        });

                        // 🔥 2. SALVA AS RESERVAS NA LIXEIRA (SE EXISTIREM)
                        await Promise.all(
                          toDelete.map((r) =>
                            addDoc(collection(db, "lixeira"), {
                              ...r,
                              firestoreId: r.id,
                              type: "reserva",
                              deletedAt: Date.now(),
                            }),
                          ),
                        );

                        // 🔥 3. REMOVE AS RESERVAS DO FIREBASE
                        await Promise.all(
                          toDelete.map((r) =>
                            deleteDoc(doc(db, "reservas", r.id)),
                          ),
                        );

                        // 🔥 4. REMOVE O CLIENTE DO FIREBASE
                        await deleteDoc(doc(db, "clients", c.id));

                        // 🔥 5. ATUALIZA ESTADO LOCAL
                        setReservations((prev) =>
                          prev.filter(
                            (r) => cleanPhone(r.phone) !== cleanPhone(c.phone),
                          ),
                        );

                        setClients((prev) =>
                          prev.filter((cli) => cli.phone !== c.phone),
                        );
                      } catch (error) {
                        console.error("Erro ao excluir cliente:", error);
                      }
                    }
                  }}
                  style={{
                    position: "absolute",
                    top: "10px",
                    right: "10px",
                    background: "transparent",
                    border: "none",
                    fontSize: "16px",
                    cursor: "pointer",
                  }}
                >
                  ✖
                </button>

                <button
                  onClick={() => {
                    const phone = c.phone.replace(/\D/g, "");
                    window.open(`https://wa.me/55${phone}`);
                  }}
                  style={{
                    position: "absolute",
                    bottom: "10px",
                    right: "10px", // 🔥 muda aqui
                    background: "#25D366",
                    border: "none",
                    borderRadius: "8px",
                    padding: "6px 10px",
                    cursor: "pointer",
                    color: "#fff",
                    fontWeight: "bold",
                    fontSize: "12px",
                  }}
                >
                  WhatsApp
                </button>

                <p>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      marginBottom: "10px",
                    }}
                  >
                    {editingPhone === c.phone ? (
                      <>
                        <input
                          value={editData.name}
                          onChange={(e) =>
                            setEditData({ ...editData, name: e.target.value })
                          }
                        />

                        <input
                          value={editData.phone}
                          onChange={(e) =>
                            setEditData({ ...editData, phone: e.target.value })
                          }
                        />
                      </>
                    ) : (
                      <>
                        <b>{c.name}</b>
                      </>
                    )}

                    <button
                      onClick={() => {
                        setEditingPhone(c.phone);
                        setEditData({ name: c.name, phone: c.phone });
                      }}
                      style={{
                        position: "absolute",
                        top: "10px",
                        right: "40px",
                        background: "transparent",
                        border: "none",
                        cursor: "pointer",
                      }}
                    >
                      ✏️
                    </button>

                    {editingPhone === c.phone && (
                      <button
                        onClick={async () => {
                          try {
                            const oldPhone = cleanPhone(c.phone);
                            const newPhone = cleanPhone(editData.phone);

                            // 🔥 mantém sua lógica + logs
                            const toUpdate = reservations.filter((r) => {
                              console.log(
                                "Comparando:",
                                cleanPhone(r.phone),
                                oldPhone,
                              );
                              return cleanPhone(r.phone) === oldPhone;
                            });

                            console.log("Cliente:", oldPhone);
                            console.log(
                              "Reservas:",
                              reservations.map((r) => cleanPhone(r.phone)),
                            );
                            console.log("Filtradas:", toUpdate.length);
                            console.log(toUpdate);

                            await Promise.all(
                              toUpdate
                                .filter((r) => r.id)
                                .map(async (r) => {
                                  try {
                                    await updateDoc(doc(db, "reservas", r.id), {
                                      name: editData.name,
                                      phone: newPhone, // 🔥 AQUI FOI CORRIGIDO
                                    });
                                  } catch (err) {
                                    console.error(
                                      "Erro ao atualizar reserva:",
                                      r.id,
                                      err,
                                    );
                                  }
                                }),
                            );

                            // 🔥 ATUALIZA CLIENTE (corrigido)
                            await updateDoc(doc(db, "clients", c.id), {
                              name: editData.name,
                              phone: newPhone, // 🔥 AQUI FOI CORRIGIDO
                            });

                            // 🔥 mantém sua lógica original (ajustada)
                            const updatedClients = clients.map((cli) =>
                              cleanPhone(cli.phone) === oldPhone
                                ? {
                                    ...cli,
                                    name: editData.name,
                                    phone: newPhone,
                                  }
                                : cli,
                            );

                            setClients(updatedClients);

                            // 🔥 usuário logado (corrigido)
                            if (cleanPhone(user.phone) === oldPhone) {
                              setUser({
                                ...user,
                                name: editData.name,
                                phone: newPhone,
                              });

                              setTempUser({
                                ...user,
                                name: editData.name,
                                phone: newPhone,
                              });
                            }

                            setEditingPhone(null);
                          } catch (error) {
                            console.error("Erro ao editar cliente:", error);
                            alert("Erro ao salvar alterações");
                          }
                        }}
                      >
                        Salvar
                      </button>
                    )}
                  </div>
                </p>
                <p>
                  <b>Telefone:</b> {formatPhone(c.phone)}
                </p>
                <p>
                  <b>Total de reservas:</b> {c.total}
                </p>
                <p>
                  <b>Reservas ativas:</b> {c.active}
                </p>
              </div>
            ))}

          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginTop: "15px",
            }}
          ></div>
        </div>
      );
    }
  }
  if (adminPage === "addClient") {
    return (
      <div
  className="container"
  style={{
    width: "100%",
    maxWidth: "500px",
    margin: "0 auto",
    padding: "10px",
    overflow: "hidden",
  }}
>
        <Back />
        <h2>NOVO CLIENTE</h2>
        <input
          placeholder="Nome"
          value={newClient.name}
          onChange={(e) => setNewClient({ ...newClient, name: e.target.value })}
        />
        <input
          placeholder="Telefone"
          value={newClient.phone}
          onChange={(e) => {
            let value = e.target.value.replace(/\D/g, "");

            if (value.length > 11) value = value.slice(0, 11);

            if (value.length > 6) {
              value = value.replace(/^(\d{2})(\d{5})(\d{0,4})$/, "($1) $2-$3");
            } else if (value.length > 2) {
              value = value.replace(/^(\d{2})(\d{0,5})$/, "($1) $2");
            } else {
              value = value.replace(/^(\d*)$/, "($1");
            }

            setNewClient({ ...newClient, phone: value });
          }}
        />
        <Button
          text="Salvar"
          onClick={async () => {
            if (!newClient.name || !newClient.phone) {
              alert("Preencha todos os campos");
              return;
            }

            const phone = newClient.phone.replace(/\D/g, "");

            if (phone.length !== 11) {
              alert("Telefone inválido");
              return;
            }

            const clean = cleanPhone(newClient.phone);

            const alreadyExists = clients.some(
              (c) => cleanPhone(c.phone) === clean,
            );

            if (alreadyExists) {
              alert("Já existe um cliente com esse telefone!");
              return;
            }

            await addDoc(collection(db, "clients"), {
              name: newClient.name,
              phone: clean,
              createdAt: Date.now(),
            });

            setNewClient({ name: "", phone: "" });
            setAdminPage("clients");
          }}
        />
      </div>
    );
  }

  if (adminPage === "payment") {
    return (
      <div
  className="container"
  style={{
    width: "100%",
    maxWidth: "500px",
    margin: "0 auto",
    padding: "10px",
    overflow: "hidden",
  }}
>
        <Back />

        <h2>PAGAMENTO (PIX)</h2>

        {/* PIX */}
        <div className="card">
          <p>
            <b>PIX:</b>
          </p>
          <input
            value={pixKey}
            onChange={(e) => setPixKey(e.target.value)}
            placeholder="Digite sua chave PIX"
          />
        </div>

        {/* DADOS DA CONTA */}
        <h3 style={{ marginTop: "20px" }}>DADOS DA CONTA:</h3>

        <div className="card">
          <p>
            <b>Titular:</b>
          </p>
          <input
            value={accountName}
            onChange={(e) => setAccountName(e.target.value)}
            placeholder="Nome do titular"
          />
        </div>

        <div className="card">
          <p>
            <b>Banco:</b>
          </p>
          <input
            value={bank}
            onChange={(e) => setBank(e.target.value)}
            placeholder="Nome do banco"
          />
        </div>

        <Button
          text="Salvar"
          onClick={() => {
            localStorage.setItem("pixKey", pixKey);
            localStorage.setItem("accountName", accountName);
            localStorage.setItem("bank", bank);
            alert("Dados salvos com sucesso!");
          }}
        />
      </div>
    );
  }
  if (adminPage === "trash") {
    return (
      <div
  className="container"
  style={{
    width: "100%",
    maxWidth: "500px",
    margin: "0 auto",
    padding: "10px",
    overflow: "hidden",
  }}
>
        <Back />
        <h2>LIXEIRA</h2>

        <Button
          text="🗑️ Esvaziar Lixeira"
          type="secondary"
          onClick={emptyTrash}
        />

        {deletedReservations.length === 0 && <p>Nenhum item excluído</p>}

        {deletedReservations.map((r, i) => (
          <div key={i} className="card">
            <p>
              <b>Cliente:</b> {r.name}
            </p>
            <p>
              <b>Telefone:</b> {formatPhone(r.phone)}
            </p>
            <p>
              <b>Esporte:</b> {r.sport}
            </p>
            <p>
              <b>Data:</b> {formatDateBR(r.date)}
            </p>
            <p>
              <b>Horário:</b>{" "}
              {(Array.isArray(r.hours) ? r.hours : []).join(", ")}
            </p>

            <button
              disabled={restoringIds.includes(r.firestoreId)}
              onClick={async () => {
                const id = r.firestoreId;

                if (restoringIds.includes(id)) return;

                setRestoringIds((prev) => [...prev, id]);

                try {
                  const restored = deletedReservations[i];

                  const exists = reservations.some(
                    (res) => res.id === restored.firestoreId,
                  );

                  if (exists) {
                    alert("Essa reserva já está ativa!");

                    setRestoringIds((prev) => prev.filter((x) => x !== id)); // 🔥 destrava
                    return;
                  }

                  // 🔥 PROTEÇÃO CONTRA DUPLICAÇÃO
                  if (restored.type !== "cliente") {
                    const alreadyExists = reservations.some((res) => {
                      const sameDate = res.date === restored.date;
                      const sameName = res.name === restored.name;
                      const samePhone = res.phone === restored.phone;

                      const sameHours =
                        JSON.stringify([...(res.hours || [])].sort()) ===
                        JSON.stringify([...(restored.hours || [])].sort());

                      return sameDate && sameName && samePhone && sameHours;
                    });

                    if (alreadyExists) {
                      alert("Essa reserva já foi restaurada!");
                      return;
                    }
                  }

                  // 🔥 RESTAURA
                  if (restored.type === "cliente") {
                    const existsClient = clients.some(
                      (c) => cleanPhone(c.phone) === cleanPhone(restored.phone),
                    );

                    if (existsClient) {
                      alert("Cliente já existe!");
                      return;
                    }

                    await addDoc(collection(db, "clients"), {
                      name: restored.name,
                      phone: restored.phone,
                      createdAt: Date.now(),
                    });
                  } else {
                    const { firestoreId, type, deletedAt, ...cleanData } =
                      restored;

                    await setDoc(doc(db, "reservas", restored.firestoreId), {
                      ...cleanData,
                      status: "ativa",
                      hours: Array.isArray(cleanData.hours)
                        ? cleanData.hours
                        : [],
                    });
                  }

                  // 🔥 REMOVE DA LIXEIRA (FIREBASE)
                  await deleteDoc(doc(db, "lixeira", restored.firestoreId));

                  // 🔥 REMOVE DO ESTADO LOCAL (IMEDIATO)
                  setDeletedReservations((prev) =>
                    prev.filter(
                      (item) => item.firestoreId !== restored.firestoreId,
                    ),
                  );
                } catch (error) {
                  console.error("Erro ao restaurar:", error);
                } finally {
                  setRestoringIds((prev) => prev.filter((x) => x !== id));
                }
              }}
              style={{
                marginTop: "10px",
                padding: "5px",
                cursor: "pointer",
                opacity: restoringIds.includes(r.firestoreId) ? 0.5 : 1,
              }}
            >
              {restoringIds.includes(r.firestoreId)
                ? "Restaurando..."
                : "Restaurar"}
            </button>
          </div>
        ))}
      </div>
    );
  }
  // ================= HOME =================
  if (page === "home") {
    return (
      <div
  className="container"
  style={{
    width: "100%",
    maxWidth: "500px",
    margin: "0 auto",
    padding: "10px",
    overflow: "hidden",
  }}
>
        <input
          type="file"
          accept="image/*"
          style={{ display: "none" }}
          id="logoInput"
          onChange={async (e) => {
            if (!isAdmin) return; // 🔒 só admin pode mudar

            const file = e.target.files[0];
            if (!file) return;

            const reader = new FileReader();

            reader.onloadend = async () => {
              try {
                const base64 = reader.result;

                await addDoc(collection(db, "config"), {
                  type: "logo",
                  value: base64,
                  createdAt: new Date(),
                });

                setLogo(base64);
              } catch (error) {
                console.error("Erro ao salvar logo:", error);
                alert("Erro ao salvar logo");
              }
            };

            reader.readAsDataURL(file);
          }}
        />

        <div
          onClick={() => {
            if (isAdmin) {
              document.getElementById("logoInput").click();
            }
          }}
          style={{
            display: "flex",
            justifyContent: "center",
            marginTop: "20px",
            marginBottom: "40px",
          }}
        >
          {logo ? (
            <img
              src={logo}
              alt="logo"
              style={{
                width: "160px",
                height: "160px",
                objectFit: "cover",
                borderRadius: "20px",
              }}
            />
          ) : (
            <div
              style={{
                width: "160px",
                height: "160px",
                background: "#ccc",
                borderRadius: "20px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              Logo
            </div>
          )}
        </div>

        <Button
          text="📅 RESERVE SEU HORÁRIO"
          onClick={() => {
            setPage("booking");
            setStep(1);
          }}
        />

        <div style={{ marginTop: "40px" }} className="grid">
          <Button
            text="👤 Seu cadastro"
            type="secondary"
            onClick={() => setPage("cadastro")}
          />
          <Button
            text="💬 WhatsApp"
            type="secondary"
            onClick={() => window.open("https://wa.me/5599981392039")}
          />
          <Button
            text="📸 Instagram"
            type="secondary"
            onClick={() => window.open("https://www.instagram.com/csm.arena")}
          />
          <Button
            text="📍 Localização"
            type="secondary"
            onClick={() =>
              window.open("https://maps.app.goo.gl/xv8KEqbyqEsnmsDR8")
            }
          />
          <Button
            text="🖼️ Fotos e Vídeos"
            type="secondary"
            onClick={() =>
              window.open(
                "https://drive.google.com/drive/folders/1OoveJqx6foyfW_Bbi8oGpuhRQLkzH4Jo?usp=sharing",
              )
            }
          />
          <Button
            text="🏆 Torneios"
            type="secondary"
            onClick={() =>
              window.open("https://forms.gle/4pDNuowTAbFRLZ4Q7", "_blank")
            }
          />

          {user.name === ADMIN.name && (
            <Button
              text="⚙️ Administração"
              type="secondary"
              onClick={() => setPage("admin")}
            />
          )}
        </div>
        <div
          style={{
            marginTop: "40px",
            textAlign: "center",
            opacity: 0.7,
          }}
        >
          <div style={{ fontSize: "16px", fontWeight: "bold" }}>CSM ARENA</div>

          <div style={{ fontSize: "14px", marginTop: "5px" }}>
            Aqui o jogo não para!🔥
          </div>
        </div>
      </div>
    );
  }

  if (page === "cadastro") {
    return (
      <div
  className="container"
  style={{
    width: "100%",
    maxWidth: "500px",
    margin: "0 auto",
    padding: "10px",
    overflow: "hidden",
  }}
>
        <Back />
        <h2>SEU CADASTRO</h2>

        <input
          placeholder="Nome"
          value={tempUser.name}
          onChange={(e) => {
            const value = e.target.value;

            if (/^[a-zA-ZÀ-ÿ\s]*$/.test(value)) {
              setTempUser({ ...tempUser, name: value });
            }
          }}
        />
        <input
          placeholder="Telefone"
          value={tempUser.phone}
          onChange={(e) => {
            let value = e.target.value.replace(/\D/g, "");

            if (value.length > 11) value = value.slice(0, 11);

            if (value.length > 6) {
              value = value.replace(/^(\d{2})(\d{5})(\d{0,4})$/, "($1) $2-$3");
            } else if (value.length > 2) {
              value = value.replace(/^(\d{2})(\d{0,5})$/, "($1) $2");
            } else {
              value = value.replace(/^(\d*)$/, "($1");
            }

            setTempUser({ ...tempUser, phone: value });
          }}
        />

        <Button
          text="Salvar"
          onClick={async () => {
            const newId = cleanPhone(tempUser.phone);

            const updatedUser = {
              ...tempUser,
              id: newId,
            };

            setUser(updatedUser);

            try {
              // 🔥 atualiza APENAS o cliente (CORRETO)
              await updateDoc(doc(db, "clients", user.id), {
                name: tempUser.name,
                phone: cleanPhone(tempUser.phone),
              });

              // 🔥 atualiza lista local de clientes
              setClients((prev) =>
                prev.map((c) =>
                  c.id === user.id
                    ? {
                        ...c,
                        name: tempUser.name,
                        phone: cleanPhone(tempUser.phone),
                      }
                    : c,
                ),
              );
            } catch (error) {
              console.error("Erro ao atualizar:", error);
            }

            setPage("home");
          }}
        />

        <h2>MINHAS RESERVAS</h2>

        {sortedReservations
          .filter(
            (r) =>
              r.status !== "expirada" &&
              cleanPhone(r.phone) === cleanPhone(user.phone),
          )
          .map((r, i) => {
            const reservaDateTime = new Date(
              r.date + "T" + (r.hours?.[0] || "00:00"),
            );
            const now = new Date();
            const diffHours = (reservaDateTime - now) / (1000 * 60 * 60);

            return (
              <div key={i} className="card">
                <p>
                  <b>Cliente:</b> {r.name}
                </p>
                <p>
                  <b>Esporte:</b> {r.sport}
                </p>
                <p>
                  <b>Data:</b> {formatDateBR(r.date)}
                </p>
                <p>
                  <b>Horário:</b>{" "}
                  {(Array.isArray(r.hours) ? r.hours : []).join(", ")}
                </p>
                <p>
                  <b>Duração:</b> {calcDuration(r.hours)}h
                </p>
                <p>
                  <b>Valor:</b> {calcPrice(r.hours)}
                </p>

                {r.status === "cancelada" ? (
                  <p className="cancelada">Reserva cancelada</p>
                ) : r.status === "concluída" ? (
                  <p style={{ color: "green", fontWeight: "bold" }}>
                    Jogo concluído
                  </p>
                ) : diffHours >= 2 ? (
                  <Button
                    text="Cancelar"
                    type="secondary"
                    onClick={async () => {
                      if (window.confirm("Tem certeza que deseja cancelar?")) {
                        try {
                          await updateDoc(doc(db, "reservas", r.id), {
                            status: "cancelada",
                          });
                        } catch (error) {
                          console.error("Erro ao cancelar:", error);
                        }
                      }
                    }}
                  />
                ) : (
                  <p className="cancel-info">
                    O prazo para cancelar expirou. VEM PRA ARENA!
                  </p>
                )}
              </div>
            );
          })}
      </div>
    );
  }

  if (page === "booking") {
    return (
      <div
  className="container"
  style={{
    width: "100%",
    maxWidth: "500px",
    margin: "0 auto",
    padding: "10px",
    overflow: "hidden",
  }}
>
        <Back />

        {step === 1 && (
          <>
            <h2>JÁ POSSUI CADASTRO?</h2>
            <Button text="SIM" onClick={() => setStep(2)} />
            <Button text="NÃO" onClick={() => setPage("cadastro")} />
          </>
        )}

        {step === 2 && (
          <>
            <h3 style={{ marginBottom: "10px" }}>DADOS DO JOGADOR</h3>

            <button
  onClick={() => {
    if (isAdmin) setShowClients(!showClients);
  }}
  style={{
    width: "100%",
    padding: "12px",
    borderRadius: "10px",
    border: "1px solid #ccc",
    background: "#fff",
    color: "#000", // 👈 AQUI ESTÁ A CORREÇÃO
    marginBottom: "10px",
    cursor: isAdmin ? "pointer" : "default",
    textAlign: "left",
  }}
>
  {activeClient.name
    ? `${activeClient.name} (${activeClient.phone})`
    : "Nome do Jogador"}
</button>

            {isAdmin && showClients && (
              <div
                style={{
                  maxHeight: "200px",
                  overflowY: "auto",
                  border: "1px solid #ccc",
                  borderRadius: "10px",
                  padding: "10px",
                  marginBottom: "20px",
                  background: "#fff",
                }}
              >
                {/* 🔍 CAMPO DE BUSCA */}
                <input
                  placeholder="Buscar cliente..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "8px",
                    marginBottom: "10px",
                    borderRadius: "8px",
                    border: "1px solid #ccc",
                  }}
                />
                {allClients
                  .filter((c) =>
                    (c.name || "")
                      .toLowerCase()
                      .includes((search || "").toLowerCase()),
                  )
                  .map((c) => (
                    <div
                      key={c.id}
                      onClick={() => {
                        setSelectedClient(c);
                        setShowClients(false);
                      }}
                      style={{
                        padding: "10px",
                        marginBottom: "5px",
                        borderRadius: "8px",
                        cursor: "pointer",
                        background:
                          cleanPhone(user.phone) === cleanPhone(c.phone)
                            ? "#eafaf1"
                            : "transparent",
                      }}
                    >
                      <b>{c.name}</b>
                      <br />
                      <span style={{ fontSize: "12px" }}>
                        {formatPhone(c.phone)}
                      </span>
                    </div>
                  ))}
              </div>
            )}

            <h2 style={{ marginTop: "10px" }}>ESCOLHA O ESPORTE</h2>
            {sports.map((s) => (
              <Button
                key={s}
                text={s}
                type="secondary"
                active={booking.sport === s}
                onClick={() => setBooking({ ...booking, sport: s })}
              />
            ))}
            <Button
              text="Próximo"
              onClick={() => {
                if (!activeClient?.phone) return alert("Selecione um jogador");
                if (!booking.sport) return alert("Escolha um esporte");
                setBooking((prev) => ({
                  ...prev,
                  client: activeClient, // 🔥 trava o cliente aqui
                }));

                setStep(3);
              }}
            />
          </>
        )}

        {step === 3 && (
          <>
            <h2>ESCOLHA A DATA</h2>

            <input
              type="date"
              min={new Date().toLocaleDateString("sv-SE")}
              onChange={(e) => setBooking({ ...booking, date: e.target.value })}
            />

            <Button
              text="Próximo"
              onClick={async () => {
                if (!booking.date) return alert("Escolha uma data");

                try {
                  // 🔥 verifica se já existe reserva pendente desse usuário
                  const existing = reservations.find(
                    (r) => r.phone === user.phone && r.status === "pendente",
                  );

                  if (existing) {
                    setBooking((prev) => ({
                      ...prev,
                      tempId: existing.id, // 🔥 GUARDA O ID
                    }));

                    setStep(4);
                    return;
                  }

                  // 🔥 cria nova reserva
                  const docRef = await addDoc(collection(db, "reservas"), {
                    sport: booking.sport,
                    date: booking.date,
                    hours: [],
                    name: booking.client?.name,
                    phone: cleanPhone(booking.client?.phone),
                    status: "pendente",
                    expiresAt: Date.now() + 3 * 60 * 1000,
                    createdAt: Date.now(),
                  });

                  // 🔥 ADICIONE ISSO
                  console.log("CRIADO ID:", docRef.id);

                  // 🔥 GUARDA O ID
                  setBooking((prev) => ({
                    ...prev,
                    tempId: docRef.id,
                  }));

                  setStep(4);
                } catch (error) {
                  console.error("Erro ao criar reserva temporária:", error);
                  alert("Erro ao reservar horário");
                }
              }}
            />
          </>
        )}

        {step === 4 && (
          <>
            <h2>ESCOLHA O HORÁRIO</h2>

            <div className="grid">
              {hours.map((h) => {
                const past = isPastHour(h);
                const booked = isBooked(h);

                return (
                  <button
                    key={h}
                    disabled={past || booked}
                    className={
                      past || booked
                        ? "hour disabled"
                        : (Array.isArray(booking.hours)
                              ? booking.hours
                              : []
                            ).includes(h)
                          ? "selected"
                          : "hour"
                    }
                    onClick={() => toggleHour(h)}
                  >
                    {h}
                  </button>
                );
              })}
            </div>

            <Button
              text="Próximo"
              onClick={() => {
                if (!booking.date) return alert("Escolha uma data");
                const hours = Array.isArray(booking.hours) ? booking.hours : [];

                if (hours.length === 0) return alert("Escolha um horário");

                setStep(5);
              }}
            />
          </>
        )}

        {step === 5 && (
          <>
            <h2>RESUMO DA RESERVA</h2>

            <div className="card">
              <p>
                <b>Nome:</b> {booking.client?.name}
              </p>
              <p>
                <b>Telefone:</b> {formatPhone(booking.client?.phone)}
              </p>
              <p>
                <b>Esporte:</b> {booking.sport}
              </p>
              <p>
                <b>Data:</b> {formatDateBR(booking.date)}
              </p>
              <p>
                <b>Horários:</b>{" "}
                {(Array.isArray(booking.hours) ? booking.hours : []).join(", ")}
              </p>
              <p>
                <b>Duração:</b>{" "}
                {calcDuration(
                  Array.isArray(booking.hours) ? booking.hours : [],
                )}
                h
              </p>
              <p>
                <b>Valor:</b>{" "}
                {calcPrice(Array.isArray(booking.hours) ? booking.hours : [])}
              </p>
            </div>

            <div
              className="card"
              style={{ marginTop: "15px", background: "#fff3cd" }}
            >
              <h3>⚠️ AVISO IMPORTANTE</h3>
              <p>
                <b>Tolerância de atraso:</b> 15 minutos
              </p>
              <p>
                <b>Prazo p/cancelar:</b> Até 2h antes da reserva
              </p>
            </div>

            <p style={{ marginTop: "20px", fontWeight: "bold" }}>
              Te aguardamos na Arena! 💪🔥
            </p>

            <Button
              text="Confirmar"
              onClick={() => {
                if (!user.name || !user.phone) {
                  alert(
                    "Por favor, complete seu cadastro antes de finalizar a reserva.",
                  );
                  setPage("cadastro");
                  return;
                }

                setPage("payment");
                setPaymentTime(300);
                setConfirmEnabled(false);
              }}
            />
          </>
        )}
      </div>
    );
  }

  if (page === "payment") {
    const accountName = localStorage.getItem("accountName") || "";
    const bank = localStorage.getItem("bank") || "";

    const minutes = Math.floor(paymentTime / 60);
    const seconds = paymentTime % 60;

    const sorted = [
      ...(Array.isArray(booking.hours) ? booking.hours : []),
    ].sort((a, b) => hourToNumber(a) - hourToNumber(b));

    const startHour = hourToNumber(sorted[0]);
    const endHour = hourToNumber(sorted[sorted.length - 1]);

    const isNight = startHour >= 18 || endHour > 18;
    const paymentValue = isNight ? "R$ 10,00" : "R$ 5,00";

    return (
      <div
  className="container"
  style={{
    width: "100%",
    maxWidth: "500px",
    margin: "0 auto",
    padding: "10px",
    overflow: "hidden",
  }}
>
        <button
          className="back"
          onClick={() => {
            setPage("booking");
            setStep(5);
          }}
        >
          ← Voltar
        </button>

        <h2>PAGAMENTO</h2>

        <p>Confirme sua reserva com o pagamento inicial!</p>

        <p style={{ color: "red", fontSize: "14px" }}>
          * Este valor não será devolvido em caso de cancelamento
        </p>

        {/* VALOR */}
        <div className="card" style={{ textAlign: "left" }}>
          <p>
            <b>Valor da reserva:</b> {paymentValue}
          </p>
        </div>

        {/* PIX + BOTÃO */}
        <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
          <div className="card" style={{ flex: 1, textAlign: "left" }}>
            <p>
              <b>PIX:</b> {pixKey}
            </p>
          </div>

          <button
            onClick={() => {
              navigator.clipboard.writeText(pixKey);
              alert("PIX copiado!");
            }}
            style={{
              background: "#2c4f73",
              color: "#fff",
              border: "none",
              borderRadius: "10px",
              padding: "12px",
              cursor: "pointer",
              fontWeight: "bold",
              whiteSpace: "nowrap",
            }}
          >
            COPIAR PIX
          </button>
        </div>

        {/* DADOS DA CONTA */}
        <div className="card" style={{ marginTop: "10px", textAlign: "left" }}>
          <p>
            <b>DADOS DA CONTA:</b>
          </p>
          <p>
            <b>Titular:</b> {accountName}
          </p>
          <p>
            <b>Banco:</b> {bank}
          </p>
        </div>

        {/* TEMPO */}
        <p style={{ marginTop: "10px", fontSize: "13px" }}>
          ⏱ Tempo restante: {minutes}:{String(seconds).padStart(2, "0")}
        </p>

        {/* BOTÃO */}
        <button
          className="btn"
          style={{
            background: confirmEnabled ? "" : "gray",
            cursor: confirmEnabled ? "pointer" : "not-allowed",
          }}
          disabled={!confirmEnabled}
          onClick={async () => {
            if (!confirmEnabled) return;

            try {
              // 🔥 verifica conflito antes de confirmar
              const conflito = reservations.find((r) => {
                if (
                  r.id === booking.tempId ||
                  r.status === "cancelada" ||
                  r.status === "expirada"
                )
                  return false;

                if (r.date !== booking.date) return false;

                const hoursR = Array.isArray(r.hours) ? r.hours : [];
                const hoursB = Array.isArray(booking.hours)
                  ? booking.hours
                  : [];

                return hoursB.some((h) => hoursR.includes(h));
              });

              if (conflito) {
                alert(
                  "⚠️ Esse horário acabou de ser reservado por outra pessoa!",
                );
                setPage("booking");
                setStep(4);
                return;
              }

              console.log("TEMP ID:", booking.tempId);

              if (!booking?.tempId) {
                console.error("tempId não existe");
                return;
              }

              await updateDoc(doc(db, "reservas", booking.tempId), {
                ...booking,
                name: booking.client?.name,
                phone: cleanPhone(booking.client?.phone),
                hours: Array.isArray(booking.hours) ? booking.hours : [],
                status: "ativa",
                createdAt: Date.now(),
              });

              setBooking({ sport: "", date: "", hours: [] });
              setPage("success");
            } catch (error) {
              console.error("Erro ao salvar:", error);
              alert("Erro ao salvar reserva");
            }
          }}
        >
          Confirmar Reserva
        </button>

        {/* TEXTO QUE SOME */}
        {!confirmEnabled && (
          <p style={{ fontSize: "12px", marginTop: "10px", opacity: 0.6 }}>
            O botão será liberado após o pagamento do valor parcial desta
            reserva.
          </p>
        )}
      </div>
    );
  }
  if (page === "success") {
  return (
    <div
  className="container"
  style={{
    width: "100%",
    maxWidth: "500px",
    margin: "0 auto",
    padding: "10px",
    overflow: "hidden",
  }}
>
      <h2 style={{ color: "black" }}>✅ Reserva confirmada com sucesso!</h2>
      <Button text="Voltar ao início" onClick={() => setPage("home")} />
    </div>
  );
}
}
