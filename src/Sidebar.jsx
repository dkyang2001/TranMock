import styles from "./Sidebar.module.css";
import React, {
  useImperativeHandle,
  useRef,
  forwardRef,
  useEffect,
} from "react";
import cx from "classnames";
/*************************************************************
 * state explanation:
 * 1. No Agency, everything is empty
 * 2. Sidebar in main, show all routes
 * 3. Sidebar in main, show route for stop
 * 4. Sidebar in popUp, show arrival estimates
 * ************************************************************/
const Sidebar = forwardRef(function Sidebar(
  { state, stop, routes, arrival, color, open, distance, functions },
  Sidebar
) {
  const cardContainer = useRef(null);
  useImperativeHandle(Sidebar, () => ({
    getContainer: () => {
      return cardContainer.current;
    },
  }));

  useEffect(() => {
    //add border on sidebar during scroll
    if (cardContainer.current) {
      cardContainer.current.addEventListener("scroll", (e) => {
        if (e.currentTarget.scrollTop > 10) {
          cardContainer.current.classList.add(`${styles.active}`);
        } else {
          cardContainer.current.classList.remove(`${styles.active}`);
        }
      });
    }
  }, []);
  /******* Things for state 1 where no agency exists*********************/
  const height = cardContainer.current ? cardContainer.current.clientHeight : 0;
  const largeSectionOpacity = height / 270;
  const smallSectionOpacity = 1 - largeSectionOpacity;
  /*********************************************************************/
  function countActiveRoutes() {
    let sum = 0;
    for (let i = 0; i < routes.length; i++) {
      if (routes[i].active) sum++;
    }
    return sum;
  }
  return (
    <div className={styles.sidebar}>
      <div className={styles.holdIcon}></div>
      <div
        className={styles.titleContainer}
        onTouchStart={functions[2]}
        onTouchMove={functions[3]}
        onTouchEnd={functions[4]}
        onClick={functions[5]}
      >
        {state === 1 ? (
          <h5 style={{ opacity: smallSectionOpacity }}>
            There are no active routes within ~{distance} miles
          </h5>
        ) : state === 2 ? (
          <h4>
            Showing {countActiveRoutes()} of {routes.length} routes in this area
          </h4>
        ) : state === 3 ? (
          <>
            <div className={styles.stopPic}></div>
            <h4>
              {routes.length > 1 ? routes.length + " routes " : "1 route "}
              serving {stop.name}
            </h4>
          </>
        ) : (
          <>
            <div
              className={styles.stopPic}
              style={{ backgroundColor: "#" + color }}
            ></div>
            <h4>{stop.name}</h4>
          </>
        )}
      </div>
      <div
        ref={cardContainer}
        className={cx(styles.cardContainer, !open ? styles.closed : null)}
      >
        {state == 1 ? (
          <div
            className={styles.noneSection}
            style={{ opacity: largeSectionOpacity }}
          >
            <h2>There are no active routes</h2>
            <h2 className={styles.noQuoteEnd}>within ~{distance} miles</h2>
            <h4>Move the map to explore routes</h4>
          </div>
        ) : state == 4 ? (
          arrival.map((arrival, index) => (
            <ArrivalCard key={index} arrival={arrival} />
          ))
        ) : (
          routes.map((route) => (
            <RouteCard
              key={route.route_id}
              route={route}
              functions={functions}
              stop={stop}
              state={state}
            />
          ))
        )}
      </div>
    </div>
  );
});
/***********************For state 2 and 3: sidebar inside popUp*******************/
function RouteCard({ state, route, functions }) {
  return (
    <div
      className={styles.routeCard}
      onClick={(e) => {
        functions[1](route.route_id);
      }}
    >
      <BusToggleButton
        active={route.active}
        name={route.short_name}
        color={route.color}
        clickFunction={() => {
          functions[0](route.route_id);
        }}
      />
      <div>
        <div className={styles.route_name}>{route.long_name}</div>
        <div className={styles.agency_name}>{route.agencyName}</div>
      </div>
      <div className={styles.cardRightPanel}>
        {state === 3 && route.remaining !== null && (
          <>
            <div className={styles.wifiIcon}>
              <div className={`${styles.wifi} ${styles.second}`}></div>
              <div className={`${styles.wifi} ${styles.first}`}></div>
            </div>
            <div className={styles.timeSection}>
              {Number(route.remaining) >= 1 ? (
                <>
                  <div className={styles.remaining}>{route.remaining}</div>
                  <div>min</div>
                </>
              ) : (
                <div className={styles.remaining}>Arriving</div>
              )}
            </div>
          </>
        )}
        <div className={styles.arrow}></div>
      </div>
    </div>
  );
}
function BusToggleButton({ active, name, color, clickFunction }) {
  return (
    <div
      className={styles.button}
      style={{
        backgroundColor: active ? "#" + color : "white",
        borderColor: "#" + color,
      }}
      onClick={(e) => {
        e.stopPropagation();
        clickFunction();
      }}
    >
      <div className={cx(styles.circle, active ? styles.active : null)}></div>
      <div className={styles.shortName}>{name}</div>
    </div>
  );
}
/**********************************************************************/
/***********************For state 4:sidebar insidepopUp****************/
function ArrivalCard({ arrival }) {
  return (
    <div className={styles.arrivalCard}>
      <div className={styles.leftPanel}>
        <div className={styles.stopIcon}></div>
        {arrival ? <h5>{arrival.busName}</h5> : <h5>- - -</h5>}
      </div>
      {arrival && (
        <div className={styles.cardRightPanel}>
          <div className={styles.wifiIcon}>
            <div className={`${styles.wifi} ${styles.second}`}></div>
            <div className={`${styles.wifi} ${styles.first}`}></div>
          </div>
          <div className={styles.timeSection}>
            {Number(arrival.remaining) >= 1 ? (
              <>
                <div className={styles.remaining}>{arrival.remaining}</div>
                <div>min</div>
              </>
            ) : (
              <div className={styles.remaining}>Arriving</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
/**********************************************************************/
export default Sidebar;
