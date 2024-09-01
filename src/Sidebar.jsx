import styles from "./Sidebar.module.css";
import React, {
  useImperativeHandle,
  useRef,
  forwardRef,
  useEffect,
  useState,
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
  {
    state,
    stop,
    routes,
    arrival,
    color,
    open,
    distance,
    isFavorite,
    geoLocState,
    currLoc,
    title,
    functions,
  },
  Sidebar
) {
  const [click, setClick] = useState(0);
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
  useEffect(() => {
    const timer = setTimeout(() => {
      // simple click
      if (click === 1) functions.enableGeo();
      setClick(0);
    }, 250);

    // the duration between this click and the previous one
    // is less than the value of delay = double-click
    if (click === 2) functions.disableGeo();

    return () => clearTimeout(timer);
  }, [click]);
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
      {state !== 4 && (
        <div
          className={cx(
            styles.geoLocate,
            geoLocState === 1 ? styles.loading : null
          )}
          onClick={() => setClick((prev) => prev + 1)}
        >
          <svg
            width="40px"
            height="40px"
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M12 20C16.4183 20 20 16.4183 20 12M12 20C7.58172 20 4 16.4183 4 12M12 20V22M20 12C20 7.58172 16.4183 4 12 4M20 12H22M12 4C7.58172 4 4 7.58172 4 12M12 4V2M4 12H2"
              stroke={geoLocState !== 2 ? "gray" : "#0194c7"}
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <circle
              fill={geoLocState !== 2 ? "gray" : "#0194c7"}
              cx="12"
              cy="12"
              r="4"
            />
          </svg>
        </div>
      )}
      <div className={styles.holdIcon}></div>
      <div
        className={styles.titleContainer}
        onTouchStart={functions.touchStart}
        onTouchMove={functions.touchMove}
        onTouchEnd={functions.touchEnd}
        onClick={functions.clickOpen}
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
            <div>
              <div className={styles.titleLeftTop}>
                <div
                  className={styles.stopPic}
                  style={{ backgroundColor: color }}
                ></div>
                <h4>{stop.name}</h4>
              </div>
              {currLoc && <div className={styles.currLoc}>{currLoc}</div>}
            </div>
            <div
              className={styles.heart}
              onClick={() => {
                functions.toggleFavorite();
              }}
            >
              <svg
                width="20px"
                height="20px"
                viewBox="0 0 24 24"
                fill={isFavorite ? color : "none"}
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  fillRule="evenodd"
                  clipRule="evenodd"
                  d="M12 6.00019C10.2006 3.90317 7.19377 3.2551 4.93923 5.17534C2.68468 7.09558 2.36727 10.3061 4.13778 12.5772C5.60984 14.4654 10.0648 18.4479 11.5249 19.7369C11.6882 19.8811 11.7699 19.9532 11.8652 19.9815C11.9483 20.0062 12.0393 20.0062 12.1225 19.9815C12.2178 19.9532 12.2994 19.8811 12.4628 19.7369C13.9229 18.4479 18.3778 14.4654 19.8499 12.5772C21.6204 10.3061 21.3417 7.07538 19.0484 5.17534C16.7551 3.2753 13.7994 3.90317 12 6.00019Z"
                  stroke={isFavorite ? color : "gray"}
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
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
            <ArrivalCard key={index} arrival={arrival} title={title} />
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
        functions.routeClick(route.route_id);
      }}
    >
      <BusToggleButton
        active={route.active}
        name={route.isCAT ? route.long_name : route.short_name}
        color={route.color}
        clickFunction={() => {
          functions.toggleActive(route.route_id);
        }}
      />
      {route.favorite && (
        <svg
          width="20px"
          height="20px"
          viewBox="0 0 24 24"
          fill={route.color}
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            fillRule="evenodd"
            clipRule="evenodd"
            d="M12 6.00019C10.2006 3.90317 7.19377 3.2551 4.93923 5.17534C2.68468 7.09558 2.36727 10.3061 4.13778 12.5772C5.60984 14.4654 10.0648 18.4479 11.5249 19.7369C11.6882 19.8811 11.7699 19.9532 11.8652 19.9815C11.9483 20.0062 12.0393 20.0062 12.1225 19.9815C12.2178 19.9532 12.2994 19.8811 12.4628 19.7369C13.9229 18.4479 18.3778 14.4654 19.8499 12.5772C21.6204 10.3061 21.3417 7.07538 19.0484 5.17534C16.7551 3.2753 13.7994 3.90317 12 6.00019Z"
            stroke={route.color}
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      )}
      <div className={styles.nameSection}>
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
        backgroundColor: active ? color : "white",
        borderColor: color,
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
function ArrivalCard({ arrival, title }) {
  //title is for schedules to put route name instead of vehicle id
  return (
    <div className={styles.arrivalCard}>
      <div className={styles.leftPanel}>
        <div className={styles.stopIcon}></div>
        {arrival ? (
          arrival.isSchedule ? (
            <h5 style={{ color: "gray" }}>{title}</h5>
          ) : (
            <h5>{arrival.call_name}</h5>
          )
        ) : (
          <h5>- - -</h5>
        )}
      </div>
      {arrival && (
        <div className={styles.cardRightPanel}>
          {arrival.isSchedule ? (
            <div style={{ color: "gray" }}>{arrival.stopTime}</div>
          ) : (
            <>
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
            </>
          )}
        </div>
      )}
    </div>
  );
}
/**********************************************************************/
export default Sidebar;
