import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Font,
} from "@react-pdf/renderer";
import { format } from "date-fns";
import { pl } from "date-fns/locale";

Font.register({
  family: "Roboto",
  src: "https://cdnjs.cloudflare.com/ajax/libs/ink/3.1.10/fonts/Roboto/roboto-regular-webfont.ttf",
});

const styles = StyleSheet.create({
  page: {
    padding: 20,
    fontSize: 8,
    fontFamily: "Roboto",
  },
  header: {
    textAlign: "center",
    marginBottom: 10,
    borderBottom: 2,
    paddingBottom: 5,
  },
  title: {
    fontSize: 14,
    fontWeight: "bold",
  },
  subtitle: {
    fontSize: 9,
    color: "#666",
  },
  mainGrid: {
    flexDirection: "row",
    marginBottom: 10,
  },
  box: {
    border: 1,
    padding: 8,
    marginRight: 5,
    marginBottom: 5,
  },
  boxTitle: {
    fontSize: 7,
    fontWeight: "bold",
    marginBottom: 5,
    color: "#666",
  },
  boxContent: {
    fontSize: 9,
  },
  leftColumn: {
    width: "50%",
  },
  rightColumn: {
    width: "50%",
  },
  row: {
    flexDirection: "row",
    marginBottom: 2,
  },
  label: {
    width: 80,
    fontSize: 7,
    color: "#666",
  },
  value: {
    flex: 1,
    fontSize: 8,
  },
  goodsSection: {
    border: 1,
    marginBottom: 10,
    minHeight: 100,
  },
  goodsHeader: {
    backgroundColor: "#f0f0f0",
    padding: 5,
    fontWeight: "bold",
    fontSize: 8,
  },
  goodsContent: {
    padding: 8,
  },
  instructionsBox: {
    border: 1,
    padding: 8,
    marginBottom: 10,
    minHeight: 60,
  },
  signaturesRow: {
    flexDirection: "row",
    marginTop: 15,
  },
  signatureBox: {
    flex: 1,
    border: 1,
    padding: 8,
    marginRight: 5,
    minHeight: 50,
  },
  signatureTitle: {
    fontSize: 7,
    fontWeight: "bold",
    marginBottom: 3,
  },
  cmrNumber: {
    position: "absolute",
    top: 20,
    right: 20,
    fontSize: 10,
    fontWeight: "bold",
  },
  footer: {
    position: "absolute",
    bottom: 15,
    left: 20,
    right: 20,
    fontSize: 6,
    color: "#999",
    textAlign: "center",
  },
});

interface CMRDocumentProps {
  shipment: {
    shipment_number: string;
    dispatch_date: string;
    transport_temperature: number | null;
    driver_name: string | null;
    truck_plates: string | null;
    trailer_plates: string | null;
    seal_number: string | null;
    destination_address_json: Record<string, unknown>;
  };
  sender: {
    name: string;
    address?: string;
    country?: string;
  };
  recipient: {
    name: string;
    address?: string;
    country?: string;
  } | null;
  carrier: {
    name: string;
    address?: string;
  } | null;
  goodsDescription: string;
  totalNetWeight: number;
  totalGrossWeight: number;
  palletsCount: number;
}

export function CMRDocument({
  shipment,
  sender,
  recipient,
  carrier,
  goodsDescription,
  totalNetWeight,
  totalGrossWeight,
  palletsCount,
}: CMRDocumentProps) {
  const formatDate = (date: string) => {
    return format(new Date(date), "dd.MM.yyyy", { locale: pl });
  };

  const destinationAddress = shipment.destination_address_json as {
    street?: string;
    city?: string;
    country?: string;
  };

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>CMR</Text>
          <Text style={styles.subtitle}>
            MIĘDZYNARODOWY LIST PRZEWOZOWY / International Consignment Note
          </Text>
        </View>

        <Text style={styles.cmrNumber}>Nr: {shipment.shipment_number}</Text>

        {/* Main Grid - Sender, Recipient, Carrier */}
        <View style={styles.mainGrid}>
          <View style={styles.leftColumn}>
            {/* Box 1 - Sender */}
            <View style={styles.box}>
              <Text style={styles.boxTitle}>1. NADAWCA / Sender</Text>
              <Text style={styles.boxContent}>{sender.name}</Text>
              <Text style={{ fontSize: 7 }}>{sender.address || ""}</Text>
              <Text style={{ fontSize: 7 }}>{sender.country || "Polska"}</Text>
            </View>

            {/* Box 2 - Recipient */}
            <View style={styles.box}>
              <Text style={styles.boxTitle}>2. ODBIORCA / Consignee</Text>
              <Text style={styles.boxContent}>{recipient?.name || "-"}</Text>
              <Text style={{ fontSize: 7 }}>
                {destinationAddress?.street || ""}
              </Text>
              <Text style={{ fontSize: 7 }}>
                {destinationAddress?.city || ""} {destinationAddress?.country || ""}
              </Text>
            </View>

            {/* Box 3 - Place of delivery */}
            <View style={styles.box}>
              <Text style={styles.boxTitle}>3. MIEJSCE DOSTAWY / Place of delivery</Text>
              <Text style={styles.boxContent}>
                {destinationAddress?.city || recipient?.name || "-"}
              </Text>
            </View>
          </View>

          <View style={styles.rightColumn}>
            {/* Box 16 - Carrier */}
            <View style={styles.box}>
              <Text style={styles.boxTitle}>16. PRZEWOŹNIK / Carrier</Text>
              <Text style={styles.boxContent}>{carrier?.name || "Transport własny"}</Text>
              <Text style={{ fontSize: 7 }}>{carrier?.address || ""}</Text>
            </View>

            {/* Box 17 - Successive carriers */}
            <View style={styles.box}>
              <Text style={styles.boxTitle}>17. KOLEJNI PRZEWOŹNICY</Text>
              <Text style={styles.boxContent}>-</Text>
            </View>

            {/* Box 18 - Driver & Vehicle */}
            <View style={styles.box}>
              <Text style={styles.boxTitle}>18. DANE POJAZDU / Vehicle</Text>
              <View style={styles.row}>
                <Text style={styles.label}>Kierowca:</Text>
                <Text style={styles.value}>{shipment.driver_name || "-"}</Text>
              </View>
              <View style={styles.row}>
                <Text style={styles.label}>Nr rej. ciągnika:</Text>
                <Text style={styles.value}>{shipment.truck_plates || "-"}</Text>
              </View>
              <View style={styles.row}>
                <Text style={styles.label}>Nr rej. naczepy:</Text>
                <Text style={styles.value}>{shipment.trailer_plates || "-"}</Text>
              </View>
              <View style={styles.row}>
                <Text style={styles.label}>Nr plomby:</Text>
                <Text style={styles.value}>{shipment.seal_number || "-"}</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Goods Section */}
        <View style={styles.goodsSection}>
          <Text style={styles.goodsHeader}>
            6-12. OPIS TOWARU / Description of goods
          </Text>
          <View style={styles.goodsContent}>
            <View style={styles.row}>
              <Text style={styles.label}>Rodzaj towaru:</Text>
              <Text style={styles.value}>{goodsDescription}</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.label}>Liczba palet:</Text>
              <Text style={styles.value}>{palletsCount}</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.label}>Waga netto:</Text>
              <Text style={styles.value}>{totalNetWeight.toFixed(2)} kg</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.label}>Waga brutto:</Text>
              <Text style={styles.value}>{totalGrossWeight.toFixed(2)} kg</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.label}>Temp. transportu:</Text>
              <Text style={styles.value}>
                {shipment.transport_temperature !== null
                  ? `${shipment.transport_temperature}°C`
                  : "-"}
              </Text>
            </View>
          </View>
        </View>

        {/* Instructions */}
        <View style={styles.instructionsBox}>
          <Text style={styles.boxTitle}>13. INSTRUKCJE NADAWCY / Sender&apos;s instructions</Text>
          <Text style={{ fontSize: 8 }}>
            Towar wymaga zachowania temperatury {shipment.transport_temperature || "-18"}°C
            przez cały czas transportu.
          </Text>
        </View>

        {/* Dates */}
        <View style={{ flexDirection: "row", marginBottom: 10 }}>
          <View style={[styles.box, { flex: 1 }]}>
            <Text style={styles.boxTitle}>21. DATA ZAŁADUNKU</Text>
            <Text style={styles.boxContent}>{formatDate(shipment.dispatch_date)}</Text>
          </View>
          <View style={[styles.box, { flex: 1 }]}>
            <Text style={styles.boxTitle}>MIEJSCE ZAŁADUNKU</Text>
            <Text style={styles.boxContent}>{sender.name}</Text>
          </View>
        </View>

        {/* Signatures */}
        <View style={styles.signaturesRow}>
          <View style={styles.signatureBox}>
            <Text style={styles.signatureTitle}>22. PODPIS NADAWCY</Text>
            <Text style={styles.signatureTitle}>Sender&apos;s signature</Text>
          </View>
          <View style={styles.signatureBox}>
            <Text style={styles.signatureTitle}>23. PODPIS PRZEWOŹNIKA</Text>
            <Text style={styles.signatureTitle}>Carrier&apos;s signature</Text>
          </View>
          <View style={[styles.signatureBox, { marginRight: 0 }]}>
            <Text style={styles.signatureTitle}>24. PODPIS ODBIORCY</Text>
            <Text style={styles.signatureTitle}>Consignee&apos;s signature</Text>
          </View>
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text>
            Dokument wygenerowany: {format(new Date(), "dd.MM.yyyy HH:mm")} | CMR - {shipment.shipment_number}
          </Text>
        </View>
      </Page>
    </Document>
  );
}
